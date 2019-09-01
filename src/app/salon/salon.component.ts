import { Component, OnInit, HostListener } from '@angular/core';
import { PopoverController, MenuController } from '@ionic/angular';
import { ApiService } from '../service/api.service';
import { User, Room, Mention, DataService } from '../service/data.service';
import { Router } from '@angular/router';
import { Socket } from 'ngx-socket-io';
import { MemberComponent } from './member/member.component';
import { AngularFirestore } from '@angular/fire/firestore';
import { UiService } from '../service/ui.service';
import { FOLDER, AUTH } from '../../environments/environment';
import { Subscription } from 'rxjs';
@Component({
  selector: 'app-salon',
  templateUrl: './salon.component.html',
  styleUrls: ['./salon.component.scss'],
})
export class SalonComponent implements OnInit {
  @HostListener('window:unload', ['$event']) unloadHandler(event) {
    this.socket.emit('disconnect');
    console.log("window unload!");
  };
  bookmk: boolean = false;
  onMembers: Array<User> = [];
  onGuests: Array<User> = [];
  offMembers: Array<User> = [];
  searchMembers: Array<User> = [];
  member: string;
  auth = AUTH;
  mentionDbSb: Subscription;
  constructor(
    public data: DataService, private api: ApiService, private router: Router, private menu: MenuController,
    private pop: PopoverController, private db: AngularFirestore, private ui: UiService, private socket: Socket,
  ) {
  }
  ngOnInit() {
    this.data.roomState.subscribe((room: Room) => {//部屋移動時
      this.newChat();//未読表示      
    });
    this.data.userState.subscribe(user => {//ログイン、ログアウト時
      if (this.mentionDbSb) this.mentionDbSb.unsubscribe();
      this.data.mentions = {}; this.data.mentionRooms = [];
      if (user.id) {//ログイン        
        let mentions: Array<Mention> = [];
        let db = this.db.collection('user').doc(user.id.toString());
        db.collection('mention').get().subscribe(query => {
          let mention;
          query.forEach(doc => {
            mention = doc.data();
            mention.id = doc.id;
            mention.rid = Number(mention.rid);
            mentions.push(mention);
          });
          this.data.mentionRoom(mentions);
        });
        this.mentionDbSb = db.collection('mention', ref => ref.orderBy('upd', 'desc')).
          snapshotChanges().subscribe((res: Array<any>) => {//メンション受領、既読削除、投稿削除で発火
            mentions = []; let mention: Mention = new Mention;
            for (let i = 0; i < res.length; i++) {
              mention = res[i].payload.doc.data();
              mention.id = res[i].payload.doc.id;
              mention.rid = Number(mention.rid);
              mentions.push(mention);
            }
            this.data.mentionRoom(mentions);
          });
      }
    });
    this.data.popMemberSubject.asObservable().subscribe((e: any) => {//アバタークリックで発火
      this.popMember(e.member, e.event);
    });
    this.socket.connect();
    this.socket.on("refresh", users => {//部屋に入った
      this.onMembers = users.filter(user => { return user.id; });
      this.onGuests = users.filter(user => { return !user.id; });
      this.api.get('member', { rid: this.data.room.id }).then(res => {//メンバー一覧読込
        this.offMembers = []; let offMembers = [];
        for (let i = 0; i < res.members.length; i++) {
          var f = true;
          for (let j = 0; j < this.onMembers.length; j++) {
            if (res.members[i].id === this.onMembers[j].id) f = false;
          }
          if (f) offMembers.push(res.members[i]);
        }
        this.offMembers = offMembers;
      });
    });
    this.socket.on("join", user => {//誰かが部屋に入った
      if (user.id) {
        this.onMembers.push(user);
        for (let i = 0; i < this.offMembers.length; i++) {
          if (this.offMembers[i].id === user.id) {
            this.offMembers.splice(i, 1); break;
          }
        }
      } else {
        this.onGuests.push(user);
      }
    });
    this.socket.on("leave", user => {//誰かが部屋から出た
      if (user.id) {
        for (let i = 0; i < this.onMembers.length; i++) {
          if (this.onMembers[i].id === user.id) {
            this.onMembers.splice(i, 1);
            if (user.auth) {
              this.offMembers.push(user);
            }
            break;
          }
        }
      } else {
        for (let i = 0; i < this.onGuests.length; i++) {
          if (this.onGuests[i].rtc === user.rtc) {
            this.onGuests.splice(i, 1); break;
          }
        }
      }
    });
    this.socket.on("rtc", user => {//誰かが放送または聴取を開始または終了した
      if (user.id) {
        for (let i = 0; i < this.onMembers.length; i++) {
          if (this.onMembers[i].id === user.id) {
            this.onMembers[i] = user; break;
          }
        }
      } else {
        for (let i = 0; i < this.onGuests.length; i++) {
          if (this.onGuests[i].rtc !== user.rtc) {
            this.onGuests[i] = user; break;
          }
        }
      }
    });
    this.socket.on("give", data => {//投げ銭受領
      if (data.mid === this.data.user.id) {
        let msg = data.txt ? "\r\n「" + data.txt + "」" : "";
        this.ui.popm(data.na + "さんから" + data.p + "ポイント贈られました。" + msg);
      }
    });
    this.socket.on("ban", id => {//誰かにKick,Banされた
      if (id === this.data.user.id) {
        this.ui.popm("kickまたはBANされたため強制ログアウトします。");
        this.data.logout();
      }
    });
  }
  joinRoom(room: Room) {//部屋移動時
    this.data.directUser = room.id > 1000000000 ? { id: room.uid, na: room.na, avatar: "" } : { id: "", na: "", avatar: "" };
    if (room.id > 0) {
      this.router.navigate(['/home/room', room.id]);
    } else if (room.id === -101) {//通知設定
      this.router.navigate(['/notify']);
    } else if (room.id === -102) {//編集、オーナーモードへ
      this.data.owner = true;
    }
    if (!room.folder) {
      this.menu.toggle('start');
    }
  }
  retRoom(home?: boolean) {//部屋一覧の親ボタン押したとき
    if (this.data.folder.id === 1 && this.data.user.id) {
      this.bookmk = !this.bookmk;
    }
    if (this.bookmk) {
      this.data.rooms = this.data.allRooms.filter(room => { return room.bookmark; });
    } else {
      if (home) {//長押しでルートに戻る
        this.data.folder = FOLDER;
      } else {
        let folder = this.data.allRooms.filter(room => { return room.id === this.data.folder.parent; });
        this.data.folder = folder.length ? folder[0] : FOLDER;
      }
      this.data.rooms = this.data.allRooms.filter(room => { return room.parent === this.data.folder.id; });
      this.router.navigate(['/home/room', this.data.folder.id]);
      this.newChat();
    }
  }
  newChat() {//未読表示
    let rids = [];
    for (let i = 0; i < this.data.rooms.length; i++) {
      rids.push(this.data.rooms[i].id);
    }
    if (rids.length) {
      this.api.get('room', { uid: this.data.user.id, rids: JSON.stringify(rids) }).then(res => {
        for (let i = 0; i < this.data.rooms.length; i++) {
          if (this.data.rooms[i].id in res.cursors) {
            let cursor = res.cursors[this.data.rooms[i].id];
            let upd = 'upd' in cursor ? new Date(cursor.upd).getTime() / 1000 :
              Math.floor(new Date(this.data.rooms[i].upd).getTime() / 1000);
            this.data.rooms[i].new = upd > new Date(cursor.csd).getTime() / 1000;
          }
        }
      });
    }
  }
  mention() {
    this.data.folder = { id: -2, na: "メンション", parent: 1 };
    this.data.rooms = this.data.mentionRooms;
  }
  mentionClear() {
    this.data.rooms = [];
    let db = this.db.collection('user').doc(this.data.user.id.toString()).collection('mention');
    db.get().subscribe(query => {
      query.forEach(doc => {
        db.doc(doc.id).delete();
      });
      this.data.mentionRooms = [];
    });
  }
  direct() {
    this.ui.loading("メッセージ確認中...");
    this.data.folder = { id: -1, na: "ダイレクトメッセージ", parent: 1 };
    this.db.collection("direct", ref => ref.where('uid_old', '==', this.data.user.id)).get().subscribe(query => {
      let rooms = [];
      query.forEach(doc => {
        let d = doc.data();
        if (d.upd) { rooms.push({ id: Number(doc.id), na: d.na_new, parent: -1, upd: d.upd.toDate(), uid: d.uid_new }); }
      });
      this.db.collection("direct", ref => ref.where('uid_new', '==', this.data.user.id)).get().subscribe(query => {
        query.forEach(doc => {
          let d = doc.data();
          if (d.upd) rooms.push({ id: Number(doc.id), na: d.na_old, parent: -1, upd: d.upd.toDate(), uid: d.uid_old });
        });
        rooms.sort((a, b) => {
          if (a.upd.getTime() > b.upd.getTime()) return -1;
          if (a.upd.getTime() < b.upd.getTime()) return 1;
          return 0;
        });
        this.data.rooms = rooms;
        this.ui.loadend();
        this.newChat();
      });
    });
  }
  config() {
    this.data.folder = { id: -3, na: "設定", parent: 1 };
    this.data.rooms = [
      { id: -101, na: "通知", parent: -3, discription: "他ユーザーがあなたにアクションしたときメールで通知する、しないを設定します。" },
    ];
    if (this.data.user.id) {
      let managers = this.data.allRooms.filter(room => { return room.auth >= 200; });
      if (managers.length) {
        this.data.rooms.push({ id: -102, na: "編集", parent: -3, discription: "あなたが役員権限を持つ部屋をカスタマイズします。" });
      }
    }
  }
  searchMember() {
    if (!this.member.trim()) return;
    this.onMembers = this.onMembers.filter(member => member.na.indexOf(this.member) !== -1);
    this.offMembers = this.offMembers.filter(member => member.na.indexOf(this.member) !== -1);
    if (!this.onMembers.length && !this.offMembers.length) {
      this.api.get('member', { search: this.member }, "検索中").then(res => {
        this.searchMembers = res.members;
      });
    }
  }
  searchMemberClear() {
    this.socket.emit("get", this.data.room.id);
    this.searchMembers = [];
  }
  async popMember(member, event: any) {
    let search = false;
    if (this.searchMembers.length) search = true;
    const popover = await this.pop.create({
      component: MemberComponent,
      componentProps: { member: member, search: search },
      event: event,
      translucent: true
    });
    return await popover.present();
  }

}
