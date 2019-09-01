import { Component, OnInit, Input, Output, EventEmitter, } from '@angular/core';
import { ApiService } from '../../service/api.service';
import { APIURL } from '../../../environments/environment';
declare var $; declare var twttr; declare var tinymce;
@Component({
  selector: 'app-storys',
  templateUrl: './storys.component.html',
  styleUrls: ['./storys.component.scss'],
})
export class StorysComponent implements OnInit {
  @Input() rid: number;
  @Input() exec;
  @Output() save = new EventEmitter<string>();
  storys = [];
  txts = [];
  medias = [];
  pays = [];
  storyLength: number;
  storyMaxid: number;
  roomimg: string;
  contextMenu = null;
  drag = null;
  newTxt = '新しい段落';
  newMedia = "ファイルをドロップ<br>または<br>右クリック";
  progress = { load: 0, total: 0 };
  tinyinit = {
    selector: ".tiny",
    menubar: false,
    inline: true,
    //theme: 'inlite',
    //language_url: 'https://bloggersguild.cf/js/ja.js',
    plugins: [
      'autolink autosave codesample link lists advlist table paste emoticons quickbars'
    ],
    toolbar: false,//'undo redo | forecolor backcolor | fontselect fontsizeselect styleselect | bullist numlist | blockquote link copy paste emoticons',
    quickbars_insert_toolbar: 'quicktable',
    quickbars_selection_toolbar: 'forecolor backcolor styleselect | bullist numlist | blockquote quicklink copy paste',
    contextmenu: 'emoticons | undo redo | up down del | paystart payend ',
    forced_root_block: false, allow_conditional_comments: true, allow_html_in_named_anchor: true, allow_unsafe_link_target: true,
    setup: (editor) => { // オリジナルのプラグインボタンの追加       
      editor.ui.registry.addMenuItem('del', { //editor.addButton(contextmenu以外のmenu)
        text: '段落を削除',
        onAction: () => {
          $("#" + editor.id).parent().fadeOut(500);
          this.save.emit("savestory");
        }
      });
      editor.ui.registry.addMenuItem('up', {
        text: '段落を上に移動',
        onAction: () => { updown(true, editor); }
      });
      editor.ui.registry.addMenuItem('down', {
        text: '段落を下に移動',
        onAction: () => { updown(false, editor); }
      });
      editor.ui.registry.addMenuItem('paystart', {
        text: 'ここから有料',
        onAction: () => {
          const idx = $("#" + editor.id).parent().attr('id');
          editor.windowManager.open({
            title: '有料設定',
            body: [
              {
                type: 'textbox',
                size: 10,
                height: '100px',
                name: 'pay',
                label: '価格',
                value: this.storys[idx].pay
              }
            ],
            onsubmit: (e) => {
              let p = e.data.pay;
              if (p >= 0 && p < 1000000 && this.storys[idx].pay != p) {
                this.storys[idx].pay = p;
                this.pays[idx] = p;
                this.save.emit("savestory");
              }
            }
          })
        }
      });
      editor.ui.registry.addMenuItem('payend', {
        text: 'ここまで有料',
        onAction: () => {
          const idx = Number($("#" + editor.id).parent().attr('id'));
          for (let i = idx; i >= 0; i--) {
            if (this.storys[i].pay > 0) {
              for (let j = i; j <= idx; j++) {
                if (this.storys[j].pay != this.storys[i].pay) {
                  this.storys[j].pay = this.storys[i].pay;
                  this.pays[j] = this.storys[i].pay;
                  this.save.emit("savestory");
                }
              }
              break;
            }
          }
        }
      });
      editor.on('blur', (e) => {
        if ($("#" + editor.id).parent().css('display') !== 'none') {
          let html = makeStory(editor);
          if (html != this.newTxt) {
            this.save.emit("savestory");
            this.txts[editor.id] = html;
          };
        }
      });
      function updown(up, editor) {
        let rep = up ? $("#" + editor.id).parent().prev() : $("#" + editor.id).parent().next();
        if (rep !== undefined) {
          if (up) {
            rep.before($("#" + editor.id).parent());
          } else {
            rep.after($("#" + editor.id).parent());
          }
          this.save.emit("savestory");
        }
      }
      function makeStory(editor) {
        var html = editor.getContent({ format: "html" });
        return html;
      }
    }
  }
  constructor(private api: ApiService) {
  }
  ngOnChanges() {
    if (this.exec === "savestory") {
      this.saveStory();
    } else if (this.exec === "undostory") {
      this.load();
      this.save.emit("done");
    } else {
      this.load();
    }
  }
  ngOnInit() {
    $(document).on('dragenter', function (e) {
      e.stopPropagation();
      e.preventDefault();
    });
    $(document).on('dragover', function (e) {
      e.stopPropagation();
      e.preventDefault();
      $(".media").css('border', '2px dotted #0B85A1');
    });
    $(document).on('drop', function (e) {
      e.stopPropagation();
      e.preventDefault();
    });
  }
  load() {
    this.api.get("owner/story", { rid: this.rid }).then((storys: any) => {
      this.storyLength = storys.length;
      this.storyMaxid = storys.length ? Math.max(...storys.map(story => story.id)) : 0;
      this.storys = storys;
      this.storys.push({ id: this.storyMaxid + 1, txt: this.newTxt, media: this.newMedia, pay: 0 });
      this.txts = []; this.medias = []; this.roomimg = "";
      for (let i = 0; i < storys.length; i++) {
        if (storys[i].media.indexOf('img') === 1) {
          this.roomimg = storys[i].id.toString();
          break;
        }
      }
      setTimeout(() => {
        twttr.widgets.load();
        tinymce.init(this.tinyinit);
      }, 1000);
    });
  }
  dragenter(e) {
    e.stopPropagation();
    e.preventDefault();
    $(e.currentTarget).css('border', '2px solid #0B85A1');
  }
  dragover(e) {
    e.stopPropagation();
    e.preventDefault();
    if (e.currentTarget.className === "row") {
      $(e.currentTarget).css('border', '1px solid lightgray');
    }
  }
  dragstart(e) {
    this.drag = e.currentTarget;
  }
  dragentertxt(e) {
    e.stopPropagation();
    e.preventDefault();
    if (this.drag && e.currentTarget.className === "row" && this.drag.id !== e.currentTarget.id) {
      $(e.currentTarget).css('border', '2px solid #0B85A1');
    }
  }
  dropmedia(e) {
    let media = e.currentTarget;
    e.preventDefault();
    if (media.className === "media") {
      $(media).css('border', '2px dotted #0B85A1');
      this.upload(e.dataTransfer.files, media);
    }
  }
  droptxt(e) {
    let drop = e.currentTarget;
    e.preventDefault();
    if (this.drag && drop.className === "row") {
      if ($("#" + this.drag.id).prev().attr('id') === drop.id) {
        $("#" + drop.id).before($("#" + this.drag.id));
      } else {
        $("#" + drop.id).after($("#" + this.drag.id));
      }
    }
    $(".row").css('border', '1px solid lightgray');
    $(".media").css('border', '2px dotted #0B85A1');
  }
  dragend() {
    let fix = $("#" + this.drag.id).children(".row");
    if (fix) fix.className = "media";
    this.drag = null;
  }
  context(e) {
    let media = e.currentTarget;
    e.stopPropagation();
    e.preventDefault();
    if (media.className !== "media") {
      media = $(media).parents(".media");
    }
    this.contextMenu = this.contextMenu ? null : { media: media, x: e.layerX, y: media.offsetTop };
  }
  fileup(e) {
    this.upload(e.target.files, this.contextMenu.media);//$(e.target).prevAll('.media'));
    this.contextMenu = null;
  }
  urlup(e) {
    this.getMedia(e.target.value, this.contextMenu.media);//$(e.target).prevAll('.media'));
    this.contextMenu = null;
  }
  mediaDel(e) {
    let media = this.contextMenu.media;
    media.innerHTML = "";
    this.medias[media.id] = "";
    this.contextMenu = null;
    this.save.emit("savestory");
  }
  newrow() {
    let id = this.storys.length ? Math.max(...this.storys.map(story => story.id)) : 0;
    this.storys.push({ id: id + 1, txt: this.newTxt, media: this.newMedia });
    setTimeout(() => {
      tinymce.init(this.tinyinit);
    });
  }
  getMedia(html, media) {
    if (!html) return;
    if (html.startsWith("<iframe") && html.endsWith("</iframe>")) {
      $(media).html(html);
      this.medias[media.id] = html;
      this.save.emit("savestory");
    } else if (html.indexOf("twitter.com") > 0) {
      let url = html.match("twitter.com/[0-9a-zA-Z_]{1,15}/status(?:es)?/[0-9]{19}");
      if (url && url.length) {
        let tweet = '<blockquote class="twitter-tweet" data-conversation="none"><a href="https://' + url[0] + '"></a></blockquote>';
        $(media).html(tweet);
        twttr.widgets.load();
        this.medias[media.id] = tweet;
        this.save.emit("savestory");
      } else {
        alert("twitterのurlを解析できませんでした。");
      }
    } else if (html.indexOf("youtu.be") > 0 || html.indexOf("youtube.com") > 0) {
      let id = html.match('[\/?=]([a-zA-Z0-9\-_]{11})');
      if (id && id.length) {
        let tag = '<img src="http://i.ytimg.com/vi/' + id[1] + '/sddefault.jpg">';
        let youtube = '<a href="https://youtube.com/watch?v=' + id[1] + '" target="_blank">' + tag + '</a>';
        $(media).html(youtube);
        this.medias[media.id] = youtube;
        this.save.emit("savestory");
      } else {
        alert("youtubeのurlを解析できませんでした。");
      }
    } else {
      alert("twitterかyoutubeのurlを入力してください。");
    }
  }
  upload(files, media) {
    if (!files.length) return;
    var rid = this.rid.toString();
    const api = this.api;
    const save = this.save;
    var storys = this.storys;
    var progress = this.progress;
    var medias = this.medias;
    const fileName = files[0].name;
    if (files[0].type.match(/image.*/)) {
      var canvas = document.querySelector('canvas');
      var ctx = canvas.getContext('2d');
      var img = new Image();
      var reader = new FileReader();
      reader.onload = () => {
        img.onload = () => {
          let w, h;
          if (img.width > img.height) {
            w = img.width > 640 ? 640 : img.width;//横長
            h = img.height * (w / img.width);
          } else {
            h = img.height > 480 ? 480 : img.height;//縦長
            w = img.width * (h / img.height);
          }
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          canvas.width = w; canvas.height = h;
          ctx.drawImage(img, 0, 0, w, h);
          canvas.toBlob(send, 'image/jpeg');
        }
        img.src = <string>reader.result;
      }
      reader.readAsDataURL(files[0]);
    } else {
      send(files[0]);
    }
    function send(file) {
      const id = Number($(media).parents(".row").attr('id'));
      storys[id].media = fileName;
      storys[id].upload = true;
      api.upload("owner/upload", { rid: rid, id: media.id, file: file }).subscribe((res: any) => {
        if (res.type == 1 && res.loaded && res.total) {
          progress.load = res.loaded;
          progress.total = res.total;
        } else if (res.body) {
          storys[id].upload = false;
          if (res.body.err === undefined) {
            let html: string;
            let src = '="' + APIURL + 'media/' + rid + '/' + media.id + '.' + res.body.ext + '?' + new Date().getTime();
            if (res.body.typ === "img") {
              html = '<img src' + src + '">';
            } else if (res.body.typ === "audio") {
              html = '<audio src' + src + '" controls>';
            } else if (res.body.typ === "video") {
              html = '<video src' + src + '" controls>';
            } else {
              html = '<a href' + src + '" download="' + media.id + '.' + res.body.ext + '"><img src="' + APIURL + 'img/download.jpg"></a>';
            }
            storys[id].media = html;//media.innerHTML = html;
            medias[media.id] = html;
            save.emit("savestory");
          } else {
            alert(res.body.err);
          }
        }
      });
    }
  }
  dateFormat(date = new Date()) {//MySQL用日付文字列作成'yyyy-M-d H:m:s'
    var y = date.getFullYear();
    var m = date.getMonth() + 1;
    var d = date.getDate();
    var h = date.getHours();
    var min = date.getMinutes();
    var sec = date.getSeconds();
    return "'" + y + "-" + m + "-" + d + " " + h + ":" + min + ":" + sec + "'";
  }
  saveStory() {
    const rid = this.rid, storys = this.storys, txts = this.txts, medias = this.medias, pays = this.pays;
    let rowCount = 0, sql = "", reload = false, newStoryLength = 0, roomimg = "";
    $("#wrap .row").each((index, row) => {
      const idx = Number($(row).attr('id'));
      const mceId = $(row).children(".tiny").attr('id');
      if ($(row).css('display') === 'none') {//削除行
        if (idx < this.storyLength) {
          sql += "DELETE FROM t21story WHERE rid=" + rid + " AND id=" + storys[idx].id + ";;\r\n";
          reload = true;
        }
      } else {
        const mediaId = $(row).find(".media").attr('id');
        if (idx >= this.storyLength) {//新規行
          if (txts[mceId] === undefined && medias[mediaId] === undefined && pays[idx] === undefined) {
            reload = true;//新規行に変更ないときは消すためにリロード
          } else {//新規保存
            let txt = txts[mceId] === undefined ? "" : txts[mceId];
            let media = medias[mediaId] === undefined ? "" : medias[mediaId];
            let pay = pays[idx] === undefined ? 0 : pays[idx];
            sql += "INSERT INTO t21story (rid,id,idx,txt,media,pay,upd) VALUES (" + rid + "," + storys[idx].id +
              "," + rowCount + ",'" + txt + "','" + media + "'," + pay + "," + this.dateFormat() + ");;\r\n";
            newStoryLength++;
          }
        } else {//既存行
          if (txts[mceId] !== undefined && storys[idx].txt != txts[mceId]) {//テキストの変更
            sql += "UPDATE t21story SET txt='" + txts[mceId] + "',rev=" + this.dateFormat() +
              " WHERE rid=" + rid + " AND id=" + storys[idx].id + ";;\r\n";
          }
          if (medias[mediaId] !== undefined) {//メディアの変更
            sql += "UPDATE t21story SET media='" + medias[mediaId] + "',rev=" + this.dateFormat() +
              " WHERE rid=" + rid + " AND id=" + storys[idx].id + ";;\r\n";
          }
          if (pays[idx] !== undefined) {//有料の変更
            sql += "UPDATE t21story SET pay='" + pays[idx] + "',rev=" + this.dateFormat() +
              " WHERE rid=" + rid + " AND id=" + storys[idx].id + ";;\r\n";
          }
          if (idx !== rowCount) {//順番の変更、要リロード
            sql += "UPDATE t21story SET idx=" + rowCount + " WHERE rid=" + rid + " AND id=" + storys[idx].id + ";;\r\n";
            reload = true;
          }
        }
        if (!roomimg) {
          let mediaHTML = $(row).find(".media").html();
          if (mediaHTML.indexOf('img') === 1) {
            roomimg = mediaId.replace("media", "");
          }
        }
        rowCount++;
      }
    });
    if (sql) {
      if (roomimg !== this.roomimg) {
        if (roomimg) {
          sql += "UPDATE t01room,t21story SET t01room.img=t21story.media WHERE t01room.id=t21story.rid AND t01room.id="
            + rid + " AND t21story.id=" + roomimg + ";;\r\n";
        } else {
          sql += "UPDATE t01room SET t01room.img=null WHERE t01room.id=" + rid + ";;\r\n";
        }
      }
      //console.log(sql);
      this.api.post("owner/story", { sql: sql.substr(0, sql.length - 1) }).subscribe((res: any) => {
        if (res.msg === "ok") {
          this.txts = []; this.medias = []; this.storyLength += newStoryLength; this.roomimg = roomimg;
          if (reload) this.load();
        } else {
          if (confirm("データベースエラーにより保存できませんでした。\n" + res.msg +
            "\n\n編集中の内容は失われますがリロードしますか。\nリロード前に編集内容をメモ帳などにコピーをお勧めします。")) {
            this.load();
          };
        }
        this.save.emit("done");
      });
    }
  }

}
