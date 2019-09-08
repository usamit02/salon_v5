import { Component, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { ApiService } from '../../service/api.service';
import { ActivatedRoute } from '@angular/router';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { DataService, User } from '../../service/data.service';
import { AlertController } from '@ionic/angular';
import { UiService } from '../../service/ui.service';
@Component({
  selector: 'app-detail',
  templateUrl: './detail.component.html',
  styleUrls: ['./detail.component.scss']
})
export class DetailComponent implements OnInit {
  paramsSb: Subscription;
  user: Member = new Member;
  constructor(private api: ApiService, private router: Router, private route: ActivatedRoute,
    private location: Location, public data: DataService, private alertController: AlertController,
    private ui: UiService) { }
  ngOnInit() {
    this.paramsSb = this.route.params.subscribe(params => {
      if (params.no > 0) {
        this.api.get('user', { no: params.no }, "読込中").then((res: Member) => {
          this.user = res;
        });
      }
    });
  }
  joinRoom(rid) {
    this.router.navigate(['/home/room', rid]);
  }
  href(url) {
    window.open(url, '_blank');
  }
  async edit(link?) {
    let header: string, inputs, buttons = [];
    buttons.push({
      text: '適用', handler: (data) => {
        let sql: string;
        if (link.idx === this.user.links.length) {
          sql = "INSERT INTO t32link (uid,idx,media,na,url) VALUES ('" + this.user.id + "'," + link.idx + ",'" +
            data.media + "','" + data.na + "','" + data.url + "');";
        } else {
          sql = "UPDATE t32link SET media='" + data.media + "',na='" + data.na + "',url='" + data.url +
            "' WHERE uid='" + this.user.id + "' AND idx=" + link.idx;
        }
        this.api.get("owner/save", { sql: sql }).then(res => {
          this.ui.pop("参照リンクを更新しました。");
          this.linkUpdate();
        });
      }
    });
    if (link) {
      inputs = [
        { name: 'media', type: 'text', value: link.media, placeholder: link.media },
        { name: 'na', type: 'text', value: link.na, placeholder: link.na },
        { name: 'url', type: 'url', value: link.url, placeholder: link.url },
      ];
      header = "参照リンク編集";
      buttons.push({
        text: '削除', handler: () => {
          let sql = "DELETE FROM t32link WHERE uid='" + this.user.id + "' AND idx=" + link.idx;
          if (link.idx < this.user.links.length - 1) {
            sql += ";\nUPDATE t32link SET idx=idx-1 WHERE uid='" + this.user.id + "' AND idx>" + link.idx;
          }
          this.api.get("owner/save", { sql: sql }).then(res => {
            this.ui.pop("参照リンクを削除しました。");
            this.linkUpdate();
          });
        }
      });
    } else {
      link = {
        media: "twitter、youtube、blogなど",
        na: "アカウント名、チャンネル名、サイト名など",
        url: "https://example.com",
        idx: this.user.links.length
      };
      inputs = [
        { name: 'media', type: 'text', placeholder: link.media },
        { name: 'na', type: 'text', placeholder: link.na },
        { name: 'url', type: 'url', placeholder: link.url },
      ];
      header = "新しい参照リンク";
    }
    const alert = await this.alertController.create({
      header: header,
      inputs: inputs,
      buttons: buttons
    });
    await alert.present();
  }
  linkUpdate() {
    let php = this.api.getm("user", { link: this.user.id }).subscribe((links: any) => {
      php.unsubscribe();
      this.user.links = links;
    });
  }
  async judge(member) {
    const alert = await this.alertController.create({
      header: member.room + "への参加を歓迎。",
      buttons: [
        {
          text: 'OK', handler: (data) => {
            this.api.get("pay/roompay", { uid: this.user.id, rid: member.rid, ok: this.data.user.id }).then(res => {
              this.ui.pop(this.user.na + "を" + member.room + "に招待。");
              member.auth = 1;
              member.class = "メンバー";
            });
          }
        },
        {
          text: 'NG', handler: () => {
            this.api.get("pay/roompay", { uid: this.user.id, rid: member.rid, ban: this.data.user.id }).then(res => {
              this.ui.pop(this.user.na + "は" + member.room + "に入れない、残念でした。");
              this.user.members = this.user.members.filter(m => { return m.rid !== member.rid; });
            });
          }
        },
      ]
    });
    await alert.present();
  }
  close() {
    this.location.back();
  }
}
class Member extends User {
  staffs: any[] = [];
  members: any[] = [];
  links: any[] = [];
  msg: string = "";
  upd: Date = new Date(0);
  rev: Date = new Date(0);
}
/*
 if (res.user) {
            this.user = res.user;
            this.user.staffs = res.staffs;
            this.user.members = res.members;
            this.user.links = res.links;
          }
*/
