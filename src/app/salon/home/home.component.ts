import { Component, OnInit } from '@angular/core';
import { PopoverController } from '@ionic/angular';
import * as firebase from 'firebase';
import { AngularFireAuth } from '@angular/fire/auth';
import { AngularFirestore } from '@angular/fire/firestore';
import { AngularFireStorage } from '@angular/fire/storage';
import { DataService, Room } from '../../service/data.service';
import { ApiService } from '../../service/api.service';
import { Observable, Subscription } from 'rxjs';
import { UiService } from '../../service/ui.service';
import { Socket } from 'ngx-socket-io';
import { LoginComponent } from '../login/login.component';
declare var tinymce;
@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent implements OnInit {
  writer: string;
  message: string;
  mediaButton = { add: false, img: false, url: false };
  addcolor: string = "light";
  media = new Media;
  uploadPercent: Observable<number>;
  sendable: boolean = false;
  typing: boolean = true;
  head: boolean = true;
  chat: boolean = false;
  rtc: string;
  mentionSb: Subscription; fabSb: Subscription;
  constructor(
    public data: DataService, private afAuth: AngularFireAuth, private db: AngularFirestore,
    private api: ApiService, private storage: AngularFireStorage,
    private ui: UiService, private socket: Socket, private pop: PopoverController,
  ) { }
  ngOnInit() {
    this.mentionSb = this.data.mentionSubject.asObservable().subscribe((member: any) => {
      var ed = tinymce.activeEditor;//メンバー窓からメンションコマンド打つと投稿書き込み欄に@メンバー名を挿入
      var endId = tinymce.DOM.uniqueId();
      ed.dom.add(ed.getBody(), 'span', { style: 'color:blue;', class: 'mention', id: member.id }, '@' + member.na);
      ed.dom.add(ed.getBody(), 'span', { id: endId }, '&nbsp;');
      ed.focus();
      var newNode = ed.dom.select('#' + endId);
      ed.selection.select(newNode[0]);
    });
    this.data.roomState.subscribe((room: Room) => {//部屋移動時投稿窓閉じる
      if (!room.chat && this.data.post) {
        if (tinymce.activeEditor) tinymce.activeEditor.destroy();//tinymce.activeEditor.setContent('');
        this.data.post = false;
      }
    });
    this.socket.removeListener('typing');
    this.socket.on("typing", writer => {
      this.writer = writer;
      setTimeout(() => {
        this.writer = "";
      }, 2000)
    });
    this.afAuth.authState.subscribe(user => {
      this.data.post = false;
      if (user) {
        //this.afAuth.auth.currentUser.getIdToken().then(res => {
        //  let token = res;
        //  this.data.login(user, token);
        //  console.log("idToken:" + token);
        //});
        this.data.post = false;
        this.data.login(user);
        let dummy = <HTMLButtonElement>document.getElementById("dummy");
        dummy.click();
      } else {
        this.data.logout();
      }
      this.rtc = "";
    });
  }
  ngAfterViewInit() {

  }
  logout() {
    this.afAuth.auth.signOut();
    this.data.logout();
  }
  send() {
    this.sendable = false;
    var upd = new Date();
    if (this.media.img && this.media.img.type.match(/image.*/)) {
      this.ui.pop("アップロードしています・・・");
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
      var that = this;
      const canvas = new Array(1);
      const ctx = new Array(1);
      canvas[0] = document.getElementById('canvas0');
      ctx[0] = canvas[0].getContext('2d');
      canvas[1] = document.getElementById('canvas1');
      ctx[1] = canvas[1].getContext('2d');
      var fileName = Math.floor(upd.getTime() / 1000) + ".jpg";
      let img = new Image();
      let reader = new FileReader();
      reader.onload = () => {
        img.onload = () => {
          let w, h;
          for (let i = 0; i < 2; i++) {
            const px = i ? 1000 : 280;
            if (img.width > img.height) {
              w = img.width > px ? px : img.width;//横長
              h = img.height * (w / img.width);
            } else {
              h = img.height > px * 0.75 ? px * 0.75 : img.height;//縦長
              w = img.width * (h / img.height);
            }
            ctx[i].clearRect(0, 0, canvas[i].width, canvas[i].height);
            canvas[i].width = w; canvas[i].height = h;
            ctx[i].drawImage(img, 0, 0, w, h);
            if (i) {
              canvas[i].toBlob(upload, 'image/jpeg');
            } else {
              canvas[i].toBlob(uploadThumb, 'image/jpeg');
            }
          }
        }
        img.src = <string>reader.result;
      }
      reader.readAsDataURL(this.media.img);
    } else {
      this.chatAdd(upd);
    }
    function uploadThumb(file: File) {
      that.storage.upload("room/" + that.data.room.id + "/" + fileName, file).catch(err => {
        alert("サムネイルのアップロードに失敗しました。\r\n" + err.message);
      });
    }
    function upload(file: File) {
      const task = that.storage.upload("room/" + that.data.room.id + "/org/" + fileName, file);
      that.uploadPercent = task.percentageChanges();
      task.catch(err => {
        alert("ファイルアップロードに失敗しました。\r\n" + err.message);
      }).then(ref => {
        that.chatAdd(upd);
        that.mediaButton.add = false;
        that.addcolor = "light";
        that.uploadPercent = null;
      });
    }
  }
  chatAdd(upd) {
    let ed = tinymce.activeEditor;
    let txt = ed.getContent({ format: 'html' });
    if (!txt && this.media.isnull()) return;
    let uid = this.data.user.id, na = this.data.user.na, rid = this.data.room.id;
    let collection = rid > 1000000000 ? 'direct' : 'room';
    let add: any = { uid: uid, na: na, avatar: this.data.user.avatar, txt: txt, upd: upd };
    if (this.media.img) {
      add.img = Math.floor(upd.getTime() / 1000) + ".jpg";
    }
    if (this.media.youtube) {
      add.youtube = this.media.youtube;
    }
    if (this.media.twitter) {
      add.twitter = this.media.twitter;
    }
    if (this.media.html) {
      add.html = this.media.html;
    }
    if (this.media.card) {
      add.card = this.media.card;
    }
    this.media = new Media();
    let inputUrl = <HTMLInputElement>document.getElementById("url");
    if (inputUrl) inputUrl.value = "";
    this.db.collection(collection).doc(rid.toString()).collection('chat').add(add).catch(err => { alert("チャット書込みに失敗しました。\r\n" + err); }).then(ref => {
      if (collection === 'direct') {
        this.db.collection('direct').doc(rid.toString()).set({ upd: upd }, { merge: true }).then(() => {
          this.api.post('send', { uid: uid, mid: this.data.directUser.id, na: na, txt: txt, rid: rid }).subscribe((res: any) => {
            if (res.msg) { alert(res.msg); }//ダイレクトメッセージがあったことをメールで送る
          });
        }).catch(err => {
          alert("メール送信に失敗しました。\r\n" + err);
        });
      } else {
        this.api.post('send', { uid: uid, rid: rid, upd: this.data.dateFormat(upd) }).subscribe((res: any) => {
          if (res.msg) { alert(res.msg); }
        });
      }
      let mentions = ed.dom.select('.mention');
      for (let i = 0; i < mentions.length; i++) {
        this.db.collection('user').doc(mentions[i].id).collection('mention').add({ uid: uid, na: na, rid: rid, upd: upd }).then(() => {
          this.api.post('send', { mid: mentions[i].id, uid: uid, na: na, rid: rid, txt: txt }).subscribe((res: any) => {
            if (res.msg) { alert(res.msg); }//メンションがあったことをメールで送る
          });
        }).catch(err => { alert("メンション書込みに失敗しました。\r\n" + err); });
      }
      setTimeout(() => {
        ed.setContent('');
      });
      setTimeout(() => {
        let content = <any>document.getElementById('chatscontent');
        content.scrollToBottom(300);
      }, 300);
    }
    );
  }
  fileup(e) {
    this.media.img = e.target.files[0];
    this.sendable = true;
    this.addcolor = "primary";
  }
  urlClick(e) {
    let url = e.target.value;
    if (url.indexOf("twitter.com") > 0) {
      url = url.match("twitter.com/[0-9a-zA-Z_]{1,15}/status(?:es)?/[0-9]{19}");
      if (url && url.length) {
        this.media.twitter = url[0];
        this.sendable = true;
      } else {
        this.ui.alert("twitterのurlを解析できませんでした。");
      }
    } else if (url.indexOf("youtu.be") > 0 || url.indexOf("youtube.com") > 0) {
      let id = url.match('[\/?=]([a-zA-Z0-9\-_]{11})');
      if (id && id.length) {
        this.media.youtube = id[1];
        this.sendable = true;
      } else {
        this.ui.alert("youtubeのurlを解析できませんでした。");
      }
    } else if (url.startsWith("<iframe") && url.endsWith("</iframe>")) {
      this.media.html = url;
      this.sendable = true;
    } else {
      let match = url.match("https?://[-_.!~*\'()a-zA-Z0-9;/?:@&=+$,%#]+");
      if (match !== null) {
        this.sendable = false;
        let php = this.api.getm('linkcard', { url: url }).subscribe((res: any) => {
          php.unsubscribe();
          if (res.title || res.image) {
            res.url = url;
            this.media.card = res;
          } else {
            this.media.html = '<a href="' + url + '" target="_blank">' + url + '</a>';
          }
          this.sendable = true;
        });
      } else {
        this.ui.pop("urlを認識できません。");
      }
    }
  }
  youtubePress() {
    window.open("https://www.youtube.com/?gl=JP&hl=ja");
  }
  twitterPress() {
    window.open("https://twitter.com/");
  }
  rtcOpen(action) {
    this.rtc = action;
    this.head = false;
  }
  rtcClose() {
    this.rtc = "";
    this.head = true;
  }
  test() {
    this.api.gets("users", {}).then(res => {
      this.ui.pop("ok");
    });
  }
  fab(button) {
    if (button === "post") {
      if (!this.data.post) {
        setTimeout(() => {
          tinymce.init({
            selector: ".tiny",
            menubar: false,
            inline: true,
            /*theme: 'inlite',
            mobile: {
              theme: 'mobile',
              plugins: ['autosave', 'emoticons', 'lists', 'autolink'],
              toolbar: ['undo', 'emoticons', 'bold', 'italic', 'styleselect']
            },
            language_url: 'https://bloggersguild.cf/js/ja.js',*/
            plugins: [
              'emoticons autolink autosave codesample link lists advlist table paste'
            ],
            toolbar: 'undo redo | emoticons | forecolor styleselect | blockquote link copy paste',
            contextmenu: 'restoredraft | inserttable cell row column deletetable | bullist numlist',
            forced_root_block: false, allow_conditional_comments: true, allow_html_in_named_anchor: true, allow_unsafe_link_target: true,
            setup: editor => {
              editor.on('NodeChange KeyDown Paste Change', e => {
                this.sendable = true;
                if (this.typing) {
                  this.socket.emit('typing', this.data.user.na);
                  this.typing = false;
                  setTimeout(() => {
                    this.typing = true;
                  }, 2000);
                }
              });
            }
          });
        }, 1000);
      } else if (tinymce.activeEditor) {
        tinymce.activeEditor.destroy();//tinymce.activeEditor.remove();//tinymce.activeEditor.setContent('');        
      }
      this.data.post = !this.data.post;
    } else {
      let provider;//: firebase.auth.AuthProvider;
      if (button === "twitter") {
        provider = new firebase.auth.TwitterAuthProvider();
      } else if (button === "facebook") {
        provider = new firebase.auth.FacebookAuthProvider();
      } else if (button === "google") {
        provider = new firebase.auth.GoogleAuthProvider();
      } else if (button === "email") {
        provider = new firebase.auth.EmailAuthProvider();
      } else if (button === "yahoo") {
        // provider = new auth.OAuthProvider("yahoo.co.jp");
      }
      //provider.addScope('email');
      this.afAuth.auth.signInWithPopup(provider).catch(reason => {
        this.ui.pop(button + "のログインに失敗しました。");
      });
    }
  }
  async popLogin(event: any) {
    const popover = await this.pop.create({
      component: LoginComponent,
      componentProps: {},
      event: event,
      translucent: true
    });
    return await popover.present();
  }
  bookmark() {
    if (this.data.user.id) {
      let room = this.data.room;
      this.api.get("bookmark", { uid: this.data.user.id, rid: room.id, bookmark: room.bookmark }).then(() => {
        let msg = room.bookmark ? "のブックマークを外しました。" : "をブックマークしました。";
        this.ui.pop("「" + room.na + "」" + msg);
        room.bookmark = !room.bookmark;
        let rooms = this.data.rooms.filter(r => { return r.id === room.id; });
        rooms[0].bookmark = !rooms[0].bookmark;
        rooms = this.data.allRooms.filter(r => { return r.id === room.id; });
        rooms[0].bookmark = !rooms[0].bookmark;
      });
    } else {
      this.ui.pop("ログインすると長押しでお気に入りの部屋をブックマークに追加できます。");
    }
  }
  ngOnDestroy() {
    this.fabSb.unsubscribe();
    this.mentionSb.unsubscribe();
    this.data.userSubject.unsubscribe();
    this.data.roomSubject.unsubscribe();
  }
}
class Media {
  public img: File = null;
  public twitter: string = "";
  public youtube: string = "";
  public html: string = "";
  public card: any = null;
  isnull(): boolean {
    if (this.img || this.twitter || this.youtube || this.html || this.card) {
      return false;
    } else {
      return true;
    }
  }
}
