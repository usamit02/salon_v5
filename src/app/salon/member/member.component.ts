import { Component, OnInit } from '@angular/core';
import { PopoverController, NavParams } from '@ionic/angular';
import { DataService } from '../../service/data.service';
import { AngularFirestore } from '@angular/fire/firestore';
import { AlertController } from '@ionic/angular';
import { ApiService } from '../../service/api.service';
import { UiService } from '../../service/ui.service';
import { Router } from '@angular/router';
import { Socket } from 'ngx-socket-io';
import { AUTH } from '../../../environments/environment'
@Component({
  selector: 'app-member',
  templateUrl: './member.component.html',
  styleUrls: ['./member.component.scss']
})
export class MemberComponent implements OnInit {
  member;
  give = { p: null, txt: "" };
  block: Number;
  online = { id: 0, na: "" };
  auth = AUTH;
  constructor(private navParams: NavParams, private pop: PopoverController, public data: DataService,
    private api: ApiService, private ui: UiService, private db: AngularFirestore, private router: Router,
    private socket: Socket, private alertController: AlertController) { }
  ngOnInit() {
    this.member = this.navParams.get('member');
    if (this.data.user.id) {
      this.api.get("member", { uid: this.data.user.id, mid: this.member.id }).then(res => {
        this.block = res.block;
      });
    }
    if (this.navParams.get('search')) {
      this.socket.removeListener("searchMember");
      this.socket.on("searchMember", rid => {
        let rooms = this.data.allRooms.filter(room => { return room.id === rid; });
        if (rooms.length) {
          this.online.id = rooms[0].id; this.online.na = rooms[0].na;
        } else {
          let parent = rid; let targets = [];
          do {
            rooms = this.data.fullRooms.filter(room => { return room.id === parent; });
            if (rooms.length) {
              targets = this.data.allRooms.filter(room => { return room.id === rooms[0].id; });
              if (targets.length) {
                this.online.id = targets[0].id; this.online.na = targets[0].na;
                break;
              }
              parent = rooms[0].parent;
            } else {
              break;
            }
          } while (parent);
        }
      });
      this.socket.emit("searchMember", this.member.id);
    }
  }
  detail() {//アカウントの詳細ページへ移動
    this.router.navigate(['/detail', this.member.no]);
    this.close();
  }
  mention() {
    this.data.mentionSubject.next(this.member);
    this.close();
  }
  direct() {//ダイレクトメッセージ
    this.close();
    this.data.directUser = this.member;
    let uid_old, uid_new, na_old, na_new;
    if (new Date(this.data.user.upd).getTime() < new Date(this.member.upd).getTime()) {
      uid_old = this.data.user.id; uid_new = this.member.id;
      na_old = this.data.user.na; na_new = this.member.na;
    } else {
      uid_old = this.member.id; uid_new = this.data.user.id;
      na_old = this.member.na; na_new = this.data.user.na
    }
    this.db.collection("direct", ref => ref.where('uid_old', '==', uid_old).where('uid_new', '==', uid_new)).get().subscribe(query => {
      if (query.docs.length) {
        this.router.navigate(['/home/room', query.docs[0].id]);
      } else {
        let id = Math.floor(new Date().getTime() / 1000).toString();
        this.db.collection("direct").doc(id).set({ uid_old: uid_old, uid_new: uid_new, na_old: na_old, na_new: na_new }).then(ref => {
          this.router.navigate(['/home/room', id])
            .catch(error => {
              alert(error);
            });
        });
      }
    });
  }
  async givePoint(give) {//ポイントを短文とともに贈る
    if (this.give.p < 1 || this.give.p > this.data.user.p) {
      this.ui.pop("ポイントが足りません。");
    } else {
      const alert = await this.alertController.create({
        header: this.member.na + "へ" + this.give.p + "Pを贈る",
        message: this.give.txt,
        buttons: [
          {
            text: 'OK', handler: (data) => {
              this.api.get("member", { uid: this.data.user.id, mid: this.member.id, point: this.give.p, txt: this.give.txt }).then(res => {
                this.socket.emit("give", { mid: this.member.id, p: this.give.p, txt: this.give.txt, na: this.data.user.na });
                this.ui.pop(this.member.na + "に" + this.give.p + "Pを贈りました。");
              }).finally(() => { this.give.p = null; this.give.txt = ""; });
            }
          },
          {
            text: '取消', role: 'cancel', cssClass: 'light'
          },
        ]
      });
      await alert.present();
    }
  }
  blocking() {
    this.api.get("member", { uid: this.data.user.id, mid: this.member.id, block: this.block }).then(res => {
      let msg = res.block ? "ブロック" : "受付開始"
      this.ui.pop(this.member.na + "からの通知を" + msg + "しました。");
      this.block = res.block;
      this.close();
    });
  }
  kick() {//現在の部屋のみのメンバー退会及びスタッフ退職
    this.ui.confirm("Kick!", this.member.na +
      "は「" + this.data.room.na + "」のメンバー、スタッフをクビになります。恨まれないように。。。").then(() => {
        if (this.member.payrid) {//メンバー
          this.api.get("pay/roompay", { uid: this.member.id, rid: this.member.payrid, ban: this.data.user.id }, "処理中").then(res => {
            this.ui.pop(this.member.na + "を強制退会処理しました。");
            this.socket.emit('ban', this.member.id);
          });
        }
        if (this.member.staffs.length) {//スタッフ
          let sql = "";
          for (let i = 0; i < this.member.staffs.length; i++) {
            sql += "DELETE FROM t03staff WHERE uid='" + this.member.id + "' AND rid=" + this.member.staffs[i].rid + ";\n";
          }
          this.api.get("owner/save", { sql: sql.substr(0, sql.length - 1) }, "処理中").then(res => {
            this.ui.pop(this.member.na + "を" + this.data.room.na + "のスタッフから外しました。");
            this.socket.emit('ban', this.member.id);
          }).catch(() => {
            this.ui.alert("データベースエラーのため" + this.member.na + "をkickできませんでした。\n C-Lifeまでお問合せください。");
          });
        }
        this.close();
      });
  }
  ban() {//アカウントのメンバー退会及びスタッフ退職させ強制ログアウト
    this.api.get("owner/ban", { uid: this.member.id, ban: this.data.user.id }, "読込中").then(res1 => {
      if (!res1.bossrooms.length && !res1.payrooms.length) {//権限外の役員や会員になっているか調べる
        this.ui.confirm("BAN!", this.member.na + "はメンバー、スタッフを全て強制退会し、アカウントを凍結されます。\r\n恨まれないように。。。").then(() => {
          this.api.get("pay/ban", { uid: this.member.id, ban: this.data.user.id }, "処理中").then(() => {
            let sql = "UPDATE t02user SET black=1 WHERE id='" + this.member.id + "';\n";
            for (let i = 0; i < res1.staffrooms.length; i++) {
              sql += "DELETE FROM t03staff WHERE uid='" + this.member.id + "' AND rid=" + res1.staffrooms[i].id + ";\n";
            }
            this.api.get("owner/save", { sql: sql.substr(0, sql.length - 1) }, "保存中").then(() => {
              this.socket.emit('ban', this.member.id);
              this.ui.pop(this.member.na + "をやっつけたぜ。");
              this.member.black = 1;
            });
          });
        });
      } else {
        let msg = ""
        if (res1.bossrooms.length) {
          msg += this.member.na + "は下記の役員ですが、あなたに人事権がないためBANできません。\n上位役員に解任を相談してください。\n";
          for (let i = 0; i < res1.bossrooms.length; i++) {
            msg += res1.bossrooms[i].na + ":" + res1.bossrooms[i].class + "\n";
          }
        }
        if (res1.payrooms.length) {
          msg += this.member.na + "は下記の会員ですが、あなたに人事権がないためBANできません。\n上位役員に退会を相談してください。\n";
          for (let i = 0; i < res1.payrooms.length; i++) {
            msg += res1.payrooms[i].na + "\n";
          }
        }
        this.ui.alert(msg);
      }
    });
    this.close();
  }
  revive() {//blackなアカウントを復活させる
    this.api.get("owner/save", { sql: "UPDATE t02user SET black=0 WHERE id='" + this.member.id + "';" }).then(res => {
      this.ui.pop(this.member.na + "は蘇った...");
      this.close();
    }).catch(res => {
      this.ui.alert("データベースエラーにより蘇生失敗しました。\n C-Lifeまでお問合せください。");
    });
  }
  chase() {//検索したアカウントが現在オンラインな部屋へ移動
    this.router.navigate(['/home/room', this.online.id]);
    this.close();
  }
  close() {
    this.pop.dismiss();
  }
}
/*
 function addRooms(parent, rooms) {
      let childs = [];
      let children = rooms.filter(room => { return room.parent === parent; });
      for (let i = 0; i < children.length; i++){
        childs = addRooms(children[i].id, rooms);
      }      
      return childs;
    }
this.db.collection('black').add({ uid: uid, upd: new Date(), ban: ban }).then(ref => {
      if (kick) this.db.collection('black').doc(ref.id).delete();//kickのときはすぐblackリストを消す、強制ログアウトのみ
    });


*/
