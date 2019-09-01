import { Component, OnInit, Input } from '@angular/core';
import { Router } from '@angular/router';
import { Socket } from 'ngx-socket-io';
import { DataService } from '../../service/data.service';
@Component({
  selector: 'app-card',
  templateUrl: './card.component.html',
  styleUrls: ['./card.component.scss'],
})
export class CardComponent implements OnInit {
  constructor(private router: Router, private socket: Socket, public data: DataService, ) { }
  @Input() rooms;
  online = {};
  ngOnInit() {
    this.socket.removeListener("nums");
    this.socket.on("nums", res => {
      for (let i = 0; i < res.length; i++) {
        this.online[res[i].id] = res[i].num;
      }
    });
  }
  ngOnChanges() {
    let childs;
    let rooms = this.rooms.map(room => {
      childs = [];
      addRooms(room.id, this.data.fullRooms);
      return { id: room.id, children: childs };
    });
    this.socket.emit("nums", rooms);
    function addRooms(parent, rooms) {
      let children = rooms.filter(room => { return room.parent === parent; });
      for (let i = 0; i < children.length; i++) {
        addRooms(children[i].id, rooms);
        childs.push(children[i].id);
      }
    }
  }
  joinRoom(room) {
    this.data.directUser = room.id > 1000000000 ? { id: room.uid, na: room.na, avatar: "" } : { id: "", na: "", avatar: "" };
    if (room.id > 0) {
      this.router.navigate(['/home/room', room.id]);
    } else if (room.id === -101) {//通知設定
      this.router.navigate(['/notify']);
    } else if (room.id === -102) {//編集、オーナーモードへ
      this.data.owner = true;
    }
  }
  ownerClick(no) {
    this.router.navigate(['/detail', no]);
  }
}
