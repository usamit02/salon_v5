import { Component, OnInit, Input } from '@angular/core';
import { ApiService } from '../../service/api.service';
import { UiService } from '../../service/ui.service';
import { DataService, Room } from '../../service/data.service';
import { APIURL } from '../../../environments/environment';
declare var twttr; declare var Payjp;
@Component({
  selector: 'app-story',
  templateUrl: './story.component.html',
  styleUrls: ['./story.component.scss']
})
export class StoryComponent implements OnInit {
  @Input() room: Room;
  storys = [];
  story: string;
  payid: number = 0;
  payjp;
  years = ["2019", "2020", "2021", "2022", "2023", "2024", "2025", "2026", "2027", "2028", "2029"];
  months = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
  card = { last4: "", bland: "", exp_year: null, exp_month: null, change: false };
  newcard = { number: "4242424242424242", cvc: "123", exp_year: "2020", exp_month: "12" };
  plan = { amount: null, billing_day: null, trial_days: null, auth_days: null, prorate: null };
  price;
  billing_day;
  trial_days;
  auth_days;
  visamaster = APIURL + "img/visamaster.jpg";
  constructor(private api: ApiService, private ui: UiService, private data: DataService) { }
  ngOnInit() {
    this.storyLoad();
  }
  storyLoad() {
    this.api.get("story", { uid: this.data.user.id, rid: this.room.id }).then(res => {
      this.storys = res.main; console.log("storyLoad:" + this.room.id);
      setTimeout(() => {
        twttr.widgets.load();
      });
    });
  }
  goPayMode(payid) {//「このサロンに加入する」ボタンを押したとき、プランとカード情報を呼んで最終確認ページへ
    if (this.data.user.id) {
      this.payid = payid;//-1は定額課金、0>はストーリー番号
      Payjp.setPublicKey("pk_live_087f0146e09e1f1eceaf0750");
      let plan: any = { uid: this.data.user.id, rid: this.room.id };
      if (payid === -1) plan.pid = this.room.plan;
      this.api.get("pay/plan", plan, "読込中").then(res => {
        if (payid === -1) {
          if (!res.plan.prorate && res.plan.billing_day) {//引き落とし日指定なのに日割りになってない、プラン保存ミス
            this.ui.alert("データーエラーにより加入できません。\r\nC-Lifeまでお問合せください。");
            this.payid = 0;
          } else {
            if (!res.plan.billing_day && !res.plan.auth_days) {
              let date = new Date();
              date.setDate(date.getDate() + res.plan.trial_days);
              res.plan.billing_day = date.getDate();
            }
            this.plan = res.plan;
            this.card = res.card;
          }
        }
      }).catch(() => { this.payid = 0; })
    } else {
      this.ui.pop("ログインしてください。");
    }
  }
  pay(token: string) {
    let charge: any = { rid: this.room.id, uid: this.data.user.id, na: this.data.user.na, token: token };
    if (this.payid >= 0) charge.sid = this.storys[this.payid].id;
    this.api.get("pay/charge", charge, "支払中").then(res => {
      if (res.typ === "plan") {//定額課金        
        this.data.readRooms();
        if (res.plan === 0) {
          this.ui.pop('ようこそ「' + this.room.na + "」へ");
          this.room.lock = 0;
          this.data.rooms.map(room => {
            if (room.id === this.room.id) {
              room.lock = 0;
            }
          });
          this.data.allRooms.map(room => {
            if (room.id === this.room.id) {
              room.lock = 0;
            }
          });
        } else if (res.plan) {
          this.ui.alert('「' + this.room.na + '」へ加入申込しました。\n審査完了まで最大' + res.plan + '日間お待ちください。');
          this.room.lock = 1;
          this.data.rooms.map(room => {
            if (room.id === this.room.id) {
              room.lock = 1;
            }
          });
          this.data.allRooms.map(room => {
            if (room.id === this.room.id) {
              room.lock = 1;
            }
          });
        }
      } else if (res.typ === "charge") {
        this.ui.pop("支払い完了しました。コンテンツをお楽しみください。");
        this.storyLoad();
      }
      else {
        this.ui.alert("課金処理に失敗しました。お問い合わせください。\n" + res.error);
      }
      this.payid = 0;
    });
  }
  newpay(card) {
    Payjp.createToken(card, (s, res) => {
      if (res.error) {
        this.ui.alert("クレジットカード情報の取得に失敗しました。");
      } else {
        this.pay(res.id);
      }
    });
  }
  leave() {
    this.ui.confirm("退会", this.room.na + "を退会します。").then(() => [
      this.api.get("pay/roompay", { uid: this.data.user.id, rid: this.room.id, ban: this.data.user.id }, "処理中").then(() => {
        this.ui.pop(this.room.na + "から脱退しました。次回ログインから入室できません。");
      })
    ]);
  }
}
