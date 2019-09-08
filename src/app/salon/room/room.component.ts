import { Component, OnInit, ViewChild, ViewChildren, QueryList } from '@angular/core';
import { IonContent, IonInfiniteScroll, ActionSheetController } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';
import { Room, DataService } from '../../service/data.service';
import { AngularFirestore, AngularFirestoreDocument } from '@angular/fire/firestore';
import { AngularFireStorage } from '@angular/fire/storage';
import { Subscription } from 'rxjs';
import { tinyinit } from '../../../environments/environment';
import { ApiService } from '../../service/api.service';
import { UiService } from '../../service/ui.service';
declare var tinymce; declare var twttr;
@Component({
  selector: 'app-room',
  templateUrl: './room.component.html',
  styleUrls: ['./room.component.scss']
})
export class RoomComponent implements OnInit {
  @ViewChild('chatscontent', { static: false }) content: IonContent;
  @ViewChild('top', { static: false }) top: IonInfiniteScroll; @ViewChild('btm', { static: false }) btm: IonInfiniteScroll;
  @ViewChildren('chatItems') chatItems: QueryList<any>;
  rid: number;//urlで指定された部屋番号=route.params.id、現在の部屋とは限らない
  room: Room = { id: null, na: null, lock: 0, shut: 0, plan: null };//現在の部屋、子コンポーネントstoryにinputさせる
  chats: Array<any> = [];//チャットデータ [0]=古い、[length-1]=最新 <div id="chatX"
  loading: boolean = false;//読み込み時の自動スクロールにion-infinate-scrollが反応するのを止める。
  dbcon: AngularFirestoreDocument<{}>;//firestore接続バッファ　ダイレクト(direct)と部屋(room)で使い分け
  topMsg: string = "";
  readed: boolean;
  newMsg: number = 0;
  newChat: number = 0;
  loadUpd: Date;//最初にチャットロードした時間
  newUpds = [];//新着メッセージ
  latest: boolean;//最新表示
  mentionTop: number = 0; mentionBtm: number = 0;
  Y: number = 0;//現在のスクロール位置
  H: number = 0;//現在の画面高さ
  cursor: Date = null;//chat読込の基準日付
  twitter: boolean = false;//twitter投稿があればtwitter.widgets.load()実行
  mentionRoomsSb: Subscription; mentionDbSb: Subscription; newchatSb: Subscription; chatSb: Subscription;
  chatItemsSb: Subscription; paramsSb: Subscription; userSb: Subscription; roomSb: Subscription; allRoomsSb: Subscription;//各rxjs、メモリリーク対策destroy時破棄用
  constructor(private actionSheetCtrl: ActionSheetController, private route: ActivatedRoute, public data: DataService, private readonly db: AngularFirestore
    , private api: ApiService, private storage: AngularFireStorage, private ui: UiService) { }
  ngOnInit() {
    this.paramsSb = this.route.params.subscribe(params => {
      this.rid = Number(params.id);
      this.cursor = params.csd ? new Date(Number(params.csd) * 1000) : null;
      this.data.readRooms().then(() => {
        this.init();
      });
    });
    this.userSb = this.data.userState.subscribe(user => {
      this.data.readRooms().then(() => {
        this.init();
      });
    });
    this.mentionRoomsSb = this.data.mentionRoomsSubject.asObservable().subscribe(mentionRooms => {
      if (this.content) this.onScrollEnd();
    });
    this.roomSb = this.data.roomState.subscribe((room: Room) => {
      this.room = room;
    });
  }
  init() {
    if (this.rid > 1000000000) {//ダイレクト
      if (this.data.user.id) {
        this.db.collection('direct').doc(this.rid.toString()).get().subscribe((doc) => {
          let direct = doc.data();
          if (direct.uid_new === this.data.user.id) {
            this.data.directUser = { id: direct.uid_old, na: direct.na_old, avatar: "" };
          } else {
            this.data.directUser = { id: direct.uid_new, na: direct.na_new, avatar: "" };
          }
          this.api.get('direct', { uid: this.data.user.id, rid: this.rid }).then(res => {
            if (res.cursor && !this.cursor) this.cursor = new Date(res.cursor);
          }).finally(() => {
            this.chatInit(this.rid);
            let room: Room = { id: this.rid, na: this.data.directUser.na + "へダイレクト", chat: true };
            this.data.joinRoom(room);
          });
        });
      }//ログインしてなければ何もしない    
    } else {
      let newRoom = new Room;
      let id: number = this.rid;
      do {//もし指定されたridの閲覧権限がない場合、権限のある直上のridを探す
        let parents = this.data.fullRooms.filter(room => { return room.id === id; });
        if (parents.length) {
          let targets = this.data.allRooms.filter(room => { return room.id === id; });
          if (targets.length) {
            newRoom = targets[0]; break;
          }
          id = parents[0].parent;
        } else {
          break;
        }
      } while (id);
      this.cursor = this.cursor || !newRoom.csd ? this.cursor : new Date(newRoom.csd);
      this.data.joinRoom(newRoom);
      if (newRoom.chat) this.chatInit(newRoom.id);
    }
  }
  chatInit(rid: number) {
    this.chats = []; this.Y = 0; this.readed = false; this.twitter = false; this.newUpds = []; this.loadUpd = new Date();
    this.dbcon = rid > 1000000000 ? this.db.collection('direct').doc(rid.toString()) : this.db.collection('room').doc(rid.toString());
    this.chatLoad(false, "btm", this.cursor); //this.chatLoad(false, this.data.room.csd || this.cursor ? "btm" : "top", this.cursor);
    if (this.newchatSb) this.newchatSb.unsubscribe();
    this.newchatSb = this.dbcon.collection('chat', ref => ref.where('upd', '>', this.loadUpd)).stateChanges(['added']).
      subscribe(action => {//チャットロード以降の書き込み 
        let chat = action[0].payload.doc.data();
        this.dbcon.collection('chat', ref => ref.where('upd', "<", chat.upd).orderBy('upd', 'desc').
          limit(1)).get().subscribe(query => {//書き込み直前のチャットを取得
            if (query.docs.length) {//初回書き込みでない
              if (query.docs[0].data().upd.toDate().getTime() === this.chats[this.chats.length - 1].upd.toDate().getTime()) {//読込済最新チャットの次の投稿
                let chatItemsSb = this.chatItems.changes.subscribe(t => {//this.chats.push(chat)の結果が描写後に発火
                  chatItemsSb.unsubscribe();
                  let chatDiv = <HTMLDivElement>document.getElementById('chat' + (this.chats.length - 1).toString());//新規チャット
                  if (this.Y + this.H > chatDiv.offsetTop) {
                    setTimeout(() => { this.content.scrollToBottom(300); });
                  } else {//画面上に最近のチャットが表示されていない
                    this.newUpds.push(chat.upd.toDate());//新着メッセージを追加
                  }
                });
                this.chats.push(chat);//チャットが連続していれば書き込みを足す
                this.chatChange();
              } else {//読込済最新チャットの次のチャットはない                
                this.newUpds.push(chat.upd.toDate());//新着メッセージを追加                
              }
            } else {//初回書き込み
              this.chats.push(chat);
              this.topMsg = "";
            }
            if (chat.twitter) {
              setTimeout(() => {
                twttr.widgets.load();
              }, 3000);
            };
          });
      });
    setTimeout(() => {
      this.onScrollEnd();
    }, 3000);
  }
  chatLoad(e, direction, cursor?: Date) {
    if (!e) {
      this.loading = true;
    } else if (this.loading) {
      e.target.complete();
      console.log("loading stop");
      return;//読込時の自動スクロールにion-infinate-scrollが反応するのを止める。
    }
    let infinate = e ? "infinate" : "init";
    console.log("chatload:" + infinate + " " + direction + " " + cursor);
    let db; this.topMsg = "";
    if (!cursor) {
      if (this.chats.length) {
        cursor = direction === 'top' ? this.chats[0].upd.toDate() : this.chats[this.chats.length - 1].upd.toDate();
      } else {//初回読込
        cursor = this.data.room.csd ? new Date(this.data.room.csd) : this.loadUpd;
      }
    }
    if (direction === 'top') {
      db = this.dbcon.collection('chat', ref => ref.where('upd', "<", cursor).orderBy('upd', 'desc').limit(20));//並び替えた後limitされるのでascはダメ
    } else {
      db = this.dbcon.collection('chat', ref => ref.where('upd', ">", cursor).where('upd', '<', this.loadUpd).
        orderBy('upd', 'asc').limit(20));
    }
    let uid: string = this.data.user.id;//自動ログイン時重複読込対策
    db.get().subscribe(query => {
      let docs1 = docsPush(query, this);
      let limit: number = direction === 'btm' && !this.chats.length && docs1.length < 20 ? 20 - docs1.length : 0;
      if (!limit) { limit = 1; cursor = new Date("1/1/1900"); }
      db = this.dbcon.collection('chat', ref => ref.where('upd', "<=", cursor).orderBy('upd', 'desc').limit(limit));
      db.get().subscribe(query => {
        if (uid !== this.data.user.id) return;//自動ログイン時重複読込対策         
        let docs2 = docsPush(query, this);
        let docs = docs2.reverse().concat(docs1);
        if (e) {//infinatescrollからの場合、スピナーを止める
          e.target.complete();
          if (!docs.length) e.target.disabled = true;//読み込むchatがなかったら以降infinatescroll無効
        }
        if (this.chats.length || docs.length) {
          if (!this.chats.length) {//新規読込
            let chatItemsSb = this.chatItems.changes.subscribe(() => {//チャット再描写後発火
              chatItemsSb.unsubscribe();
              if (direction === "top" || !docs1.length) {
                setTimeout(() => { this.content.scrollToBottom().then(() => { scrollFin(this); }); }); //this.data.scroll("btm");
              } else {
                if (docs2.length) {
                  let content = <any>document.getElementById('chatscontent');
                  let chatDivs = <any>document.getElementsByClassName('chat');
                  let cursorTop: number = 0; let cursorHeight: number = 0;
                  for (let i = 0; i < chatDivs.length; i++) {
                    if (this.chats[i].upd.toDate().getTime() >= cursor.getTime()) {
                      cursorTop = chatDivs[i].offsetTop; cursorHeight = chatDivs[i].offsetHeight; break;
                    }
                  }
                  if (chatDivs[0].offsetTop + chatDivs[0].offsetHeight - cursorTop > content.scrollHeight) {
                    setTimeout(() => { this.content.scrollToTop().then(() => { scrollFin(this); }); });
                  } else {
                    setTimeout(() => { this.content.scrollToBottom().then(() => { scrollFin(this); }); });/*this.content.getScrollElement().then(content => {content.scrollTop = content.scrollHeight;});*/
                  }
                } else {
                  this.loading = false;
                  this.content.scrollByPoint(0, 20, 300);
                }
              }
              if (this.twitter) {
                setTimeout(() => {
                  twttr.widgets.load();
                  this.twitter = false;
                }, 1000);
              }
            });
          } else {
            scrollFin(this);
          }
          if (direction === 'top') {
            if (docs1.length < 20) { this.top.disabled = true; }
            this.chats.unshift(...docs1.reverse());
          } else {
            this.chats.push(...docs);
            if (docs.length < 20 || cursor.getTime() >= new Date(this.room.upd).getTime() || cursor === this.loadUpd) {
              this.btm.disabled = true;
            }
          }
          this.chatChange();
        } else {//読み込むchatがない
          this.topMsg = "一番乗りだ！";
        }
        if (this.chats.length < 20) {
          this.top.disabled = true;
          this.btm.disabled = true;
          console.log("out of chats length :" + this.chats.length);
        }
      });
    });
    function docsPush(query, that) {//firestoreの返り値を配列へ、同時に既読位置とツイッターがあるか記録
      let docs = []
      query.forEach(doc => {
        let d = doc.data();
        if (d.upd.toDate().getTime() <= new Date(that.data.room.csd).getTime() && !that.readed) {
          d.readed = true;
          that.readed = true;
        };
        if (d.twitter) that.twitter = true;
        docs.push(d);
      });
      return docs;
    }
    function scrollFin(that) {//無限スクロールを有効にする
      setTimeout(() => { that.loading = false; }, 2000)
    }
  }
  chatChange() {
    if (this.chatSb) this.chatSb.unsubscribe();
    this.chatSb = this.dbcon.collection('chat', ref => ref.where('upd', '>=', this.chats[0].upd).
      where('upd', '<=', this.chats[this.chats.length - 1].upd)).stateChanges(['modified']).
      subscribe(action => {//チャットロード以降の変更 
        let chat = action[0].payload.doc.data();
        for (let i = 0; i < this.chats.length; i++) {
          if (this.chats[i].upd.toDate().getTime() === chat.upd.toDate().getTime()) {
            this.chats[i] = chat;
            break;
          }
        }
      });
  }
  onScrollEnd() {
    this.content.getScrollElement().then(content => {
      this.Y = content.scrollTop;//console.log("H:" + content.scrollHeight + " Top:" + content.scrollTop);
      this.H = content.offsetHeight;
      this.latest = content.scrollHeight - this.Y - this.H > 300 ? true : false;
      let upds = this.currentUpds();
      if (this.data.user.id) {
        if (upds.length) {
          this.deleteNotice(upds);
          let upd = upds[upds.length - 1];//画面上見えてる最新の日付
          if (!this.data.room.csd || new Date(this.data.room.csd).getTime() < upd.getTime()) {
            this.data.room.csd = upd;
            this.api.get("room", { uid: this.data.user.id, rid: this.room.id, csd: this.data.dateFormat(upd) });
          }
        }
      }
    });
  }
  deleteNotice(upds) {
    let upd0 = upds[0].getTime(); let upd9 = upds[upds.length - 1].getTime();
    this.newUpds = this.newUpds.filter(upd => upd.getTime() < upd0 || upd9 < upd.getTime());//新着メッセージ
    let mentions = this.data.mentions[this.room.id.toString()];//メンション
    if (mentions && mentions.length) {
      let deleteMentions = mentions.filter(mention => {
        let upd = mention.upd.toDate().getTime();
        return upd0 <= upd && upd <= upd9;// console.log(upd0 + "<=" + upd + "<=" + upd9);        
      });
      for (let i = 0; i < deleteMentions.length; i++) {
        this.db.collection('user').doc(this.data.user.id.toString()).collection('mention').doc(deleteMentions[i].id).delete();
        console.log("メンション削除" + deleteMentions[i].id + ":" + upds[0] + "<=" + deleteMentions[i].upd.toDate() + ">=" + upds[upds.length - 1]);
        mentions = mentions.filter(mention => { return mention.id !== deleteMentions[i].id; });
      }
      if (deleteMentions.length) {
        this.data.mentions[this.room.id] = mentions;
        let mentionRooms = this.data.mentionRooms.filter(mentionRoom => { return mentionRoom.id === this.room.id; });
        mentionRooms[0].count -= deleteMentions.length;
        if (!mentionRooms[0].count) {
          this.data.mentionRooms = this.data.mentionRooms.filter(mentionRoom => { return mentionRoom.id !== this.room.id; });
        }
        this.data.mentionRoomsSubject.next(this.data.mentionRooms);
      }
      let mentionTops = mentions.filter(mention => mention.upd.toDate().getTime() < upd0);
      this.mentionTop = mentionTops.length;
      let mentionBtms = mentions.filter(mention => mention.upd.toDate().getTime() > upd9);
      this.mentionBtm = mentionBtms.length;
      console.log("メンション数" + this.mentionBtm);
    } else {
      this.mentionTop = 0; this.mentionBtm = 0;
    }
  }
  currentUpds() {
    let chatItems = <any>document.getElementsByClassName('chat'); //contents.target.children[2].children;
    let upds = [];//見えてるチャットの日付の集合
    for (let i = 0; i < chatItems.length; i++) {
      if (chatItems[i].offsetTop >= this.Y &&
        chatItems[i].offsetTop + chatItems[i].offsetHeight < this.Y + this.H) {
        upds.push(this.chats[i].upd.toDate());//new Date(chats[i].children[0].innerHTML));
      }
    }
    return upds;
  }
  noticeClick(type) {//チャット最下部の固定メッセージをクリックしたとき
    let upd = this.chats[this.chats.length - 1].upd.toDate();//new Date(chats[chats.length - 1].children[0].innerHTML);
    if (type === "mention") {
      let mentions = this.data.mentions[this.room.id.toString()];
      let currentUpds = this.currentUpds();
      let loadedMentions = mentions.filter(mention =>
        mention.upd.toDate().getTime() <= upd.getTime() &&
        mention.upd.toDate().getTime() > currentUpds[currentUpds.length - 1].getTime());
      if (loadedMentions && loadedMentions.length) {
        let scrollTo: number = this.Y;
        let mentionUpd = loadedMentions[0].upd.toDate().getTime();
        for (let i = 0; i < this.chats.length; i++) {
          if (this.chats[i].upd.toDate().getTime() === mentionUpd) {
            let chat = <any>document.getElementById("chat" + i);
            scrollTo = chat.offsetTop; break;
          }
        }
        this.content.scrollToPoint(0, scrollTo, 300);
      } else {
        mentions = mentions.filter(mention => mention.upd.toDate().getTime() > upd.getTime());
        this.chats = [];
        this.chatLoad(false, "btm", mentions[mentions.length - 1].upd.toDate());
      }
    } else if (type === "newMsg") {
      if (this.newUpds[0].getTime() <= upd.getTime()) {
        this.content.scrollToBottom(300);
      } else {
        this.chats = [];
        this.chatLoad(false, "btm", this.newUpds[0]);
      }
    } else if (type === "latest") {
      this.dbcon.collection('chat', ref => ref.orderBy('upd', 'desc').limit(1)).get().subscribe(query => {
        let doc = query.docs[0].data();
        let csd = doc.upd.toDate();
        if (this.chats[this.chats.length - 1].upd.toDate().getTime() >= csd.getTime()) {//最新のchatを読込済なら
          this.content.scrollToBottom(300);
        } else {
          this.data.room.csd = null;
          this.cursor = null;
          this.chatInit(this.room.id);//カーソルをクリアして最新をリロード
        }
      });
    }
  }
  async chatClick(e, uid, na, idx) {
    if (e.target.className.indexOf('avatarItem') === -1 && e.target.localName !== 'ion-img') {//アバター上なら何もしない
      if (e.target.className.indexOf('react') !== -1) {//リアクション上なら名前の表示/非表示
        let item = e.target.children[0];
        if (item.style.display === 'none') {
          item.style.display = 'inline';
        } else {
          item.style.display = 'none';
        }
      } else {
        let buttons: Array<any> = [];
        if (this.data.user.id) {
          buttons = [
            { text: 'リアクション', icon: 'happy', handler: () => { this.emoji(e, idx); } },
            { text: '通報', icon: 'thumbs-down', handler: () => { this.tip(na, idx) } }];
        }
        if (uid === this.data.user.id || this.data.room.auth > 200) {
          buttons.push(
            { text: '編集', icon: 'brush', handler: () => { this.edit(idx); } }
          );
          buttons.push(
            { text: '削除', icon: 'trash', handler: () => { this.delete(idx); } }
          );
        }
        buttons.push({ text: 'urlをコピー', icon: 'copy', handler: () => { this.copy(idx) } });
        //buttons.push({ text: '戻る', icon: 'exit', role: 'cancel' })
        const actionSheet = await this.actionSheetCtrl.create({ header: na, buttons: buttons });
        await actionSheet.present();
      }
    }
  }
  emoji(e, idx) {
    let chats = this.chats.filter(chat => { return chat.emoji });
    for (let i = 0; i < chats.length; i++) {
      chats[i].emoji = false;
    }
    let chat = this.chats[idx];
    chat.emoji = true;
    setTimeout(() => {
      tinymce.init(
        {
          selector: ".emoji", menubar: false, inline: true, plugins: ['emoticons'], toolbar: 'emoticons',
          setup: editor => {
            editor.on('init', e => {
              let emoji = <any>document.getElementsByClassName('emoji');
              emoji[0].focus();
              let bar = <any>document.getElementsByClassName('tox-toolbar');
              let button = bar[0].children[0].children[0];//bar[0].getElementsByTagName('button');
              button.focus();
              button.click();
            });
            editor.on('change', e => {
              this.dbcon.collection('chat', ref => ref.where('upd', "==", chat.upd)).get().subscribe(query => {
                if (query.docs.length) {
                  let doc = query.docs[0].data();
                  let id: string
                  if (doc.react) {
                    id = Object.keys(doc.react).length.toString();
                  } else {
                    id = "0";
                    doc.react = {};
                  }
                  let txt = editor.getContent({ format: 'text' });
                  doc.react[id] = { upd: new Date(), emoji: txt, na: this.data.user.na };
                  this.dbcon.collection('chat').doc(query.docs[0].id).update({ react: doc.react });
                  chat.emoji = false;
                  editor.destroy();
                  editor.remove();
                } else {
                  alert('リアクション(' + chat.upd + ')に失敗しました。');
                }
              });
            });
          }
        });
    }, 200);
  }
  tip(na, idx) {//通報
    let chat = this.chats[idx];
    let tip = JSON.stringify({ uid: chat.uid, na: chat.na, txt: chat.txt, upd: chat.upd.toDate() });
    this.api.get("tip", { rid: this.room.id, room: this.data.room.na, uid: this.data.user.id, tiper: this.data.user.na, chat: tip }).then(res => {
      this.ui.pop(na + "による問題がある投稿を役員に通報しました。");
    });
  }
  copy(idx) {
    let upd = this.chats[idx].upd.toDate();
    let url = "https;//" + location.host + "/home/room/" + this.room.id + "/" + Math.floor(upd.getTime() / 1000);
    if (execCopy(url)) {
      this.ui.pop("クリップボードに投稿urlをコピーしました。");
    } else {
      this.ui.alert("クリップボードが使用できません。");
    }
    function execCopy(string) {
      var tmp = document.createElement("div");
      var pre = document.createElement('pre');
      pre.style.webkitUserSelect = 'auto';
      pre.style.userSelect = 'auto';
      tmp.appendChild(pre).textContent = string;
      var s = tmp.style;
      s.position = 'fixed';
      s.right = '200%';
      document.body.appendChild(tmp);
      document.getSelection().selectAllChildren(tmp);
      var result = document.execCommand("copy");
      document.body.removeChild(tmp);
      return result;
    }
  }
  edit(idx) {
    let chatDiv = <HTMLDivElement>document.getElementById("chat" + idx);
    let txts = chatDiv.getElementsByClassName('chattxt');
    if (txts.length) {
      let txt = <HTMLDivElement>txts[0];
      txt.classList.add("tiny");
      txt.contentEditable = 'true';
      this.chats[idx].edit = true;
      tinymce.init(tinyinit);
    }
  }
  editSend(e, idx) {
    let div = e.currentTarget.parentElement.parentElement.parentElement.getElementsByClassName("chattxt");
    let chat = this.chats[idx];//new Date(item.children[0].innerHTML);
    this.dbcon.collection('chat', ref => ref.where('upd', "==", chat.upd)).get().subscribe(query => {
      if (query.docs.length) {
        let txt = tinymce.activeEditor.getContent({ format: 'html' });
        this.dbcon.collection('chat').doc(query.docs[0].id).update({
          rev: new Date(),
          txt: txt
        });
        tinymce.activeEditor.destroy();
        tinymce.activeEditor.remove();
        div[0].classList.remove("tiny");
        div[0].contentEditable = false;
        chat.edit = false;
      } else {
        alert('編集(' + chat.upd + ')に失敗しました。');
      }
    });
  }
  delete(idx) {
    let upd = this.chats[idx].upd;
    let chatDiv = <HTMLDivElement>document.getElementById("chat" + idx);
    let mentions = chatDiv.getElementsByClassName("mention");
    for (let i = 0; i < mentions.length; i++) {
      let db = this.db.collection('user').doc(mentions[i].id);
      db.collection('mention', ref => ref.where('upd', "==", upd)).get().subscribe(query => {
        if (query.docs.length) {
          db.collection('mention').doc(query.docs[0].id).delete();
        };
      });
    }
    this.dbcon.collection('chat', ref => ref.where('upd', "==", upd)).get().subscribe(query => {
      if (query.docs.length) {
        let doc = query.docs[0].data();
        if (doc.img) {
          this.storage.ref("room/" + this.room.id + "/" + doc.img).delete();
          this.storage.ref("room/" + this.room.id + "/org/" + doc.img).delete();
        }
        this.dbcon.collection('chat').doc(query.docs[0].id).delete();
        this.chats = this.chats.filter(chat => chat.upd.toDate().getTime() !== upd.toDate().getTime());
      } else {
        alert('投稿(' + upd + ')の削除に失敗しました。');
      }
    });
  }
  popMember(e, uid) {
    this.api.get("member", { rid: this.room.id, uid: uid }).then(res => {
      let member = { id: uid, na: '', avatar: '', auth: 0, payroomid: 0, authroomid: 0 };
      if (res.members.length) member = res.members[0];
      this.data.popMemberSubject.next({
        member: member,
        event: e
      });
    });
  }
  ngOnDestroy() {
    if (this.userSb) this.userSb.unsubscribe();
    if (this.roomSb) this.roomSb.unsubscribe();
    if (this.newchatSb) this.newchatSb.unsubscribe();
    if (this.chatSb) this.chatSb.unsubscribe();
    if (this.mentionRoomsSb) this.mentionRoomsSb.unsubscribe();
    if (this.mentionDbSb) this.mentionDbSb.unsubscribe();
    if (this.paramsSb) this.paramsSb.unsubscribe();
    if (this.allRoomsSb) this.allRoomsSb.unsubscribe();
  }
}
class Chat {
  uid: string;
  na: string;
  avatar: string;
  upd;
  txt: string;
  rev?;
  edit?;
  emoji?;
  react?;
  img?;
  youtube?;
  twitter?;
  html?;
  card?;
}



/*
 this.db.collection('user').doc(this.user.id.toString()).collection('mention', ref => ref.orderBy('upd', 'desc')).get().subscribe(query => {
   let mentions = [];
   query.forEach(mention => {
     let data: any = {};
     data = mention.data();
     data.id = mention.id;
     mentions.push(data);
   });
   this.loadMentionRooms(mentions);
 });*/






/*
      setTimeout(() => {
          let chats = <any>document.getElementsByClassName('chat');
          let content = <any>document.getElementById('chatscontent');
          if (!chats.length || chats[chats.length - 1].offsetTop + chats[chats.length - 1].offsetHeight < content.scrollHeight) {
            db = dbcon.collection('chat', ref => ref.where('upd', "<=", cursor).orderBy('upd', 'desc').limit(20));
            db.get().subscribe(query => {
              docs = [];
              query.forEach(doc => {
                var d = doc.data();
                if (this.data.readedFlag) {
                  if (d.upd.toDate().getTime() <= new Date(this.data.room.csd).getTime()) {
                    d.readed = true;
                    this.data.readedFlagChange(false);
                  }
                }
                docs.push(d);
              });
            });
          }
        }, 1000);


*/
/*  this.roomSb = this.data.roomState.subscribe(room => {
      if (this.data.user.id) {
        setTimeout(() => {
          let content = <any>document.getElementById('chatscontent');
          let chats = content.children[2].children;
          var footer = <any>document.getElementById('footer');
          if (chats.length) {
            if (chats[chats.length - 1].offsetTop + chats[chats.length - 1].offsetHeight > footer.offsetTop) {
              this.onScrollEnd({ currentTarget: content });
            } else {
              var upds = [];
              for (let i = 0; i < chats.length; i++) {
                upds.push(new Date(chats[i].children[0].innerHTML))
              }
              this.deleteMention(upds);
            }
          }
        }, 3000);
      }
    });*/