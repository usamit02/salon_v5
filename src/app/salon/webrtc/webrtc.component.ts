import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { DataService } from '../../service/data.service';
import { Socket } from 'ngx-socket-io';
import { Subscription } from 'rxjs';
import { SKYWAY } from '../../../environments/environment'
declare var Peer: any;
@Component({
  selector: 'app-webrtc',
  templateUrl: './webrtc.component.html',
  styleUrls: ['./webrtc.component.scss'],
})
export class WebrtcComponent implements OnInit {
  @Input() rtc: string;
  @Output() stop = new EventEmitter<boolean>();
  peer;
  peerRoom;
  roomSb: Subscription;
  constructor(private data: DataService, private socket: Socket) { }
  ngOnInit() {
    this.roomSb = this.data.roomState.subscribe(() => {//部屋移動時
      this.stop.emit(true);
    });
  }
  ngOnChanges() {
    if (this.rtc) {
      this.rtcInit();
    } else {
      this.rtcClose()
    }
  }
  rtcInit() {
    const rtc: string = this.rtc;
    let myVideoPeerId: string;
    let yourVideoPeerId: string;
    let audioPeerId: string;
    let localStream: MediaStream;
    let myVideo: HTMLVideoElement;
    let yourVideo: HTMLVideoElement;
    let audio: HTMLAudioElement;
    let webrtcDiv = <HTMLDivElement>document.getElementById("webrtc");//document.getElementById("header").insertAdjacentHTML('beforeend', '<div id="media"></div>');
    if (rtc !== "headset") {
      let screen = rtc === 'videocam' ? { video: { width: { min: 240, max: 320 }, height: { min: 180, max: 240 } }, audio: true } : { video: false, audio: true };//{ video: { width: { min: 240, max: 320 }, height: { min: 180, max: 240 } }, audio: true } :
      navigator.mediaDevices.getUserMedia(screen).then(stream => {
        localStream = stream;
        if (rtc === 'videocam') {
          webrtcDiv.insertAdjacentHTML('beforeend', '<video id="myVideo" controls playsinline></video>');
          myVideo = <HTMLVideoElement>document.getElementById('myVideo');
          myVideo.srcObject = stream;
          myVideo.onloadedmetadata = (e) => {
            setTimeout(() => {
              myVideo.muted = true;
              myVideo.play();
              //this.content.resize();
            }, 1000);
          };
        }
      }
      ).catch(err => {
        alert("ビデオカメラが接続されていません。");
      });
    }
    this.peer = new Peer(rtc + "_" + this.data.user.id, { key: SKYWAY, debug: 3 });
    this.peer.on('open', () => {
      let peerMode = rtc === 'headset' ? { mode: 'sfu' } : { mode: 'sfu', stream: localStream };
      this.peerRoom = this.peer.joinRoom(this.data.room.id, peerMode);
      this.socket.emit('rtc', rtc);
      this.peerRoom.on('stream', stream => {
        let pid = stream.peerId.split("_");
        if (pid[1] !== this.data.user.id) {
          if (pid[0] === "mic") {
            webrtcDiv.insertAdjacentHTML('beforeend', '<audio id="audio"></audio>');
            audio = <HTMLAudioElement>document.getElementById('audio');
            audio.srcObject = stream;
            audioPeerId = stream.peerId;
            audio.play();
          } else if (pid[0] === "videocam") {
            if (!myVideo) {
              webrtcDiv.insertAdjacentHTML('beforeend', '<video id="myVideo" controls playsinline></video>');
              myVideo = <HTMLVideoElement>document.getElementById('myVideo');
              myVideo.srcObject = stream;
              myVideoPeerId = stream.peerId;
              myVideo.onloadedmetadata = (e) => {
                setTimeout(() => {
                  myVideo.play();
                  //this.content.resize();
                }, 1000);
              };
            } else {
              if (!yourVideo) {
                webrtcDiv.insertAdjacentHTML('beforeend', '<video id="yourVideo" controls playsinline></video>');
                yourVideo = <HTMLVideoElement>document.getElementById('yourVideo');
                yourVideo.srcObject = stream;
                yourVideoPeerId = stream.peerId;
                yourVideo.onloadedmetadata = (e) => {
                  setTimeout(() => {
                    yourVideo.play();
                    //this.content.resize();
                  }, 1000);
                };
              }
            }
          }
        }
      });
      this.peerRoom.on('peerLeave', peerId => {
        if (myVideo && myVideoPeerId == peerId) {
          myVideo.pause(); myVideo.srcObject = undefined; myVideoPeerId = "";
        }
        if (yourVideo && yourVideoPeerId == peerId) {
          yourVideo.pause(); yourVideo.srcObject = undefined; yourVideoPeerId = "";
        }
        if (audio && audioPeerId == peerId) {
          audio.pause(); audio.srcObject = undefined; audioPeerId = "";
        }
      });
      this.peerRoom.on('removeStream', stream => {
      });
      this.peerRoom.on('close', () => {
        if (myVideo) {
          myVideo.pause(); myVideo.srcObject = undefined; myVideoPeerId = "";
        }
        if (yourVideo) {
          yourVideo.pause(); yourVideo.srcObject = undefined; yourVideoPeerId = "";
        }
        if (audio) {
          audio.pause(); audio.srcObject = undefined; audioPeerId = "";
        }
        localStream = undefined;
        this.peer.disconnect();
      });
    });
    this.peer.on('error', err => {
      alert(err.type + ':' + err.message);
    });
    this.peer.on('close', () => {
    });
    this.peer.on('disconnected', () => {
    });
  }
  rtcClose() {
    if (this.peerRoom) {
      this.peerRoom.close();
    }
    let media = document.getElementById("webrtc");
    if (media) {
      media.textContent = null;//remove();
    }
    this.socket.emit('rtc', "");
  }
  ngOnDestroy() {
    this.rtcClose();
    this.stop.emit(true);
    this.roomSb.unsubscribe();
  }
}
