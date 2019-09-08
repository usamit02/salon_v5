import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { FormControl, FormBuilder, Validators } from '@angular/forms';
import { ApiService } from '../../service/api.service';
import { Room } from '../owner.component';
import { APIURL } from '../../../environments/environment';
@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.scss'],
})
export class MainComponent implements OnInit {
  private _room: Room;
  @Input()
  set room(_room: Room) {
    this.undoRoom(_room);
  }
  get room() {
    return this._room;
  }
  @Input() user;
  @Input() rooms;
  @Input() exec;
  @Input() hasmember;
  @Output() save = new EventEmitter<string>();
  discription = new FormControl(
    Validators.maxLength(500)
  );
  chat = new FormControl();
  story = new FormControl();
  shut = new FormControl();
  plan = new FormControl();
  amount = new FormControl(3000, [
    Validators.min(50),
    Validators.max(999999)]
  );
  billing_day = new FormControl(0, [
    Validators.min(0),
    Validators.max(31)]
  );
  trial_days = new FormControl(0, [
    Validators.min(0),
    Validators.max(365)]
  );
  auth_days = new FormControl(3, [
    Validators.min(0),
    Validators.max(30)]
  );
  prorate = new FormControl();
  roomForm = this.builder.group({
    discription: this.discription,
    chat: this.chat,
    story: this.story,
    shut: this.shut,
    plan: this.plan,
    amount: this.amount,
    billing_day: this.billing_day,
    trial_days: this.trial_days,
    auth_days: this.auth_days,
    prorate: this.prorate
  });
  logoURL: string;
  constructor(private builder: FormBuilder, private api: ApiService) { }
  ngOnInit() {
    this.roomForm.valueChanges.subscribe((formData) => {
      if (this.roomForm.dirty && formData.amount !== null) {
        if (this.roomForm.valid) {
          this.save.emit("saveroom");
        } else {
          this.save.emit("undoroom");
        }
      }
    });
  }
  ngOnChanges() {
    if (this.exec === "saveroom") {
      this.saveRoomForm();
    } else if (this.exec === "undoroom") {
      this.undoRoom(this.room);
      this.save.emit("done");
    }
  }
  changeShut() {
    if (this.shut.value) {
      this.api.get("owner/member", { rid: this.room.id }).then((res: any) => {
        if (res.error) {
          alert("データベースエラー C-Lifeまでお問合せください。\n" + res.error);
          this.shut.reset(0);
        } else if (res.hasmember) {
          alert("下層部屋に会員（審査中含む）がいるので公開を停止できません。");
          this.shut.reset(0);
        } else {
          alert("この部屋と下層部屋は非公開になります。");
        }
      }, error => {
        alert("通信エラー" + error.statusText);
      });
    }
  }
  changeStory() {
    if (!this.story.value) this.plan.reset(0);
  }
  changeProrate(prorate) {
    if (prorate) {
      this.billing_day.reset(1);
    } else {
      this.billing_day.reset(0);
    }
  }
  saveRoomForm() {
    let params: any = { room: {}, plan: {} };
    const planProp = ['amount', 'billing_day', 'trial_days', 'auth_days', 'prorate'];//t13planの保存項目、他はt01room
    for (const p of Object.keys(this.roomForm.value)) {
      if (!planProp.filter(prop => { return p === prop; }).length && !(this.roomForm.value[p] == this.room[p] || this.roomForm.value[p] == undefined)) {
        params.room[p] = this.roomForm.value[p] === false ? 0 : this.roomForm.value[p];
      }
    }
    if (this.roomForm.value.plan && planProp.filter(p => { return !(this.roomForm.value[p] == this.room[p] || this.roomForm.value[p] == undefined); }).length) {
      for (let i = 0; i < planProp.length; i++) {
        params.plan[planProp[i]] = this.roomForm.value[planProp[i]] === false ? 0 : this.roomForm.value[planProp[i]];
      }
    }
    this.api.get("owner/save", { roomForm: JSON.stringify(params), rid: this.room.id, na: this.room.na }).then(
      (res: any) => {
        if (res.msg === "ok") {
          for (const p of Object.keys(this.roomForm.value)) {
            this._room[p] = this.roomForm.value[p];
          }
          this.save.emit("roomdone");
        } else {
          alert("データベースエラー C-Lifeまでお問合せください。\n" + res.msg);
        }
      }, error => {
        alert("通信エラー" + error.statusText);
      });
  }
  undoRoom(_room) {
    this.roomForm.reset();
    this.discription.reset(_room.discription);
    this.chat.reset(_room.chat);
    this.story.reset(_room.story);
    this.shut.reset(_room.shut);
    let plan = _room.plan ? 1 : 0;
    this.plan.reset(plan);
    let amount = _room.amount > 49 ? _room.amount : 3000;
    this.amount.reset(amount);
    this.billing_day.reset(_room.billing_day);
    let trial_days = _room.traial_days ? _room.traial_days : 0;
    this.trial_days.reset(trial_days);
    let auth_days = _room.auth_days || _room.auth_days === 0 ? _room.auth_days : 3;
    this.auth_days.reset(auth_days);
    let prorate = _room.prorate ? true : false;
    this.prorate.reset(prorate);
    this._room = _room;
    this.logoURL = APIURL + "img/logo/" + _room.id + '.jpg?' + new Date().getTime();
  }
  upload(e) {
    const file = e.target.files[0];
    const rid = this.room.id.toString();
    const that = this;
    if (file.type.match(/image.*/)) {
      if (!HTMLCanvasElement.prototype.toBlob) {//edge対策
        Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
          value: function (callback, type, quality) {
            let canvas = this;
            setTimeout(function () {
              var binStr = atob(canvas.toDataURL(type, quality).split(',')[1]),
                len = binStr.length,
                arr = new Uint8Array(len);
              for (let i = 0; i < len; i++) {
                arr[i] = binStr.charCodeAt(i);
              }
              callback(new Blob([arr], { type: type || 'image/jpeg' }));
            });
          }
        });
      }
      var canvas = document.querySelector('canvas');
      var ctx = canvas.getContext('2d');
      var img = new Image();
      var reader = new FileReader();
      reader.onload = () => {
        img.onload = () => {
          let w, h;
          h = img.height > 50 ? 50 : img.height;//縦長
          w = img.width * (h / img.height);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          canvas.width = w; canvas.height = h;
          ctx.drawImage(img, 0, 0, w, h);
          canvas.toBlob(send, 'image/jpeg');
        }
        img.src = <string>reader.result;
      }
      reader.readAsDataURL(file);
    } else {
      alert("イメージファイルを選択してください。");
    }
    function send(file) {
      that.api.upload("owner/upload", { rid: rid, typ: 'logo', file: file }).subscribe((res: any) => {
        that.logoURL = APIURL + "img/logo/" + that.room.id + '.jpg?' + new Date().getTime();
        if (res.body && res.body.err) {
          alert(res.body.err);
        }
      });
    }
  }
}
