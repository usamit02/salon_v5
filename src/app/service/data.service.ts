import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { ApiService } from './api.service';
import { Socket } from 'ngx-socket-io';
import { APIURL, FOLDER } from '../../environments/environment';
@Injectable({
  providedIn: 'root'
})
export class DataService {
  owner: boolean = false;//オーナーモードへ移行
  user = new User();//現在ログインしているユーザー
  userSubject = new Subject<User>();
  userState = this.userSubject.asObservable();//ログイン、ログアウト発火
  allRooms: Array<Room> = [];//閲覧権限のある部屋
  fullRooms: Array<Room> = [];//全ての部屋
  room = new Room();//現在居る部屋
  roomSubject = new Subject<Room>();
  roomState = this.roomSubject.asObservable();//部屋移動発火
  rooms: Array<Room> = [];//部屋一覧に表示される部屋
  folder: Room = FOLDER;//部屋一覧の上部に表示される親部屋
  post: boolean;//投稿窓の開閉
  popMemberSubject = new Subject();//アバタークリック発火
  mentions;//受領したメンション一覧、key=room.id
  mentionSubject = new Subject();//メンション受領発火
  mentionRooms: Array<MentionRoom> = [];//未読メンション部屋一覧
  mentionRoomsSubject = new Subject<Array<MentionRoom>>();//未読メンションに変化発火
  directUser: User;//現在のダイレクトメッセージの相手
  constructor(private api: ApiService, private socket: Socket) { }
  login(user) {//login(user, idToken) {
    if (this.user.id !== user.uid) {
      this.api.get("user", { uid: user.uid, na: user.displayName, avatar: user.photoURL }//this.api.posts("auth", { idToken: idToken }//
      ).then(res => {
        this.user = res.user;
        //let token = res.token;
      }).catch(() => {
        this.user = new User;
      }).finally(() => {
        this.userSubject.next(this.user);
      });
    }
  }
  logout() {
    if (this.user.id) {
      this.user = new User;
      this.userSubject.next(this.user);
      this.socket.emit('logout');
    }
  }
  readRooms(): Promise<Array<Room>> {//部屋情報をサーバーから取得
    return new Promise((resolve, reject) => {
      this.api.get("room", { uid: this.user.id }).then(res => {
        this.allRooms = res.all;
        this.fullRooms = res.full;
        this.rooms = res.all.filter(room => { return room.parent === this.folder.id });
        resolve(res.all);
      });
    });
  }
  joinRoom(room: Room) {//部屋移動
    let oldRoom = this.room;
    setTimeout(() => {//Expression has changed after it was checked.エラー回避のため非同期化
      if (room.folder) {
        this.rooms = this.allRooms.filter(r => { return r.parent === room.id; });
        this.folder = room;
      }
      this.room = room;
      let user = { id: this.user.id, na: this.user.na, avatar: this.user.avatar, no: this.user.no, auth: room.auth };
      this.socket.emit('join', { newRoomId: room.id, oldRoomId: oldRoom.id, user: user });
      this.roomSubject.next(room);
      //this.rtc = "";
    });
  }
  mentionRoom(mentions: Array<Mention>) {//メンション初回読み込み、変化時
    let mentionCounts = {}; this.mentions = {};
    for (let i = 0; i < mentions.length; i++) {
      let rid = mentions[i].rid;
      mentionCounts[rid] = mentionCounts[rid] ? mentionCounts[rid] + 1 : 1;
      this.mentions[rid] = true;
    }
    Object.keys(this.mentions).forEach((key) => {
      this.mentions[key] = mentions.filter(mention => { return mention.rid === Number(key); });
    });
    this.mentionRooms = [];
    Object.keys(mentionCounts).forEach((key) => {
      let rid = Number(key);
      if (rid < 1000000000) {
        let rooms = this.fullRooms.filter(room => { return room.id === rid; });
        if (rooms.length) {
          this.mentionRooms.push({ id: rooms[0].id, na: rooms[0].na, count: mentionCounts[key] });
        }
      } else {//ダイレクト
        this.mentionRooms.push({ id: rid, na: this.mentions[key][0].na, count: mentionCounts[key] });
      }
    });
    this.mentionRoomsSubject.next(this.mentionRooms);
  }
  dateFormat(date = new Date()) {//MySQL用日付文字列作成'yyyy-M-d H:m:s'
    var y = date.getFullYear();
    var m = date.getMonth() + 1;
    var d = date.getDate();
    var h = date.getHours();
    var min = date.getMinutes();
    var sec = date.getSeconds();
    return y + "-" + m + "-" + d + " " + h + ":" + min + ":" + sec;
  }
}
export class User {
  id: string = "";
  na: string = "ビジター";
  avatar: string = APIURL + "img/avatar.jpg";
  p?: number = 0;
  no?: number = 0;
  upd?: Date;
  rev?: Date;
  direct?: string;
  black?: number = 0;
  rtc?: string = "";
}
export class Room {
  id: number = 2;
  na: string = "メインラウンジ";
  discription?: string = "";
  parent?: number = 0;
  lock?: number = 0;
  shut?: number = 0;
  idx?: number = 0;
  folder?: boolean = false;
  chat?: boolean = true;
  story?: boolean = false;
  plan?: number = 0;
  applyplan?: number = 0;
  bookmark?: boolean = false;
  csd?: string;
  upd?: string;
  new?: boolean = false;
  auth?: number = 0;
  count?: number = 0;
  uid?: string = "";
  img?: number = 0;
  member?: number = 0;
  staff?: number = 0;
}
export class Mention {
  public id: string;
  public rid: number;
  public uid: string;
  public na: string;
  public upd: Date;
}
export class MentionRoom {
  public id: number;
  public na: string;
  public count: number;
}