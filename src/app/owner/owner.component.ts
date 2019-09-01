import { Component, OnInit, ViewChild } from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { RoomsComponent } from './rooms/rooms.component'
import { DataService } from '../service/data.service';
@Component({
  selector: 'app-owner',
  templateUrl: './owner.component.html',
  styleUrls: ['./owner.component.scss'],
})
export class OwnerComponent implements OnInit {
  @ViewChild(RoomsComponent, { static: false }) protected roomTree: RoomsComponent;
  user = { id: "", na: "", avatar: "", p: 0 };
  room: Room;
  rooms;
  save;
  exec;
  hasmember: boolean = false;
  isHandset$: Observable<boolean> = this.breakpointObserver.observe(Breakpoints.Handset)
    .pipe(
      map(result => result.matches)
    );
  constructor(private breakpointObserver: BreakpointObserver, private data: DataService, ) { }

  ngOnInit() {
    //this.data.user.id = "Gx6ozdZb1hh2lit3BozKYsw0tz73";
    //this.data.user.na = "C-Life仮";
    if (this.data.user.id) {
      this.room = new Room(0, 0, "お知らせ    ", 0, "", 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
      this.user.id = this.data.user.id;
      this.user.na = this.data.user.na;
      this.user.avatar = this.data.user.avatar;
      this.user.p = this.data.user.p;
    } else {
      this.room = new Room(-1, 0, "ログインしてください");
    }
  }
  onGetRooms(rooms) {
    this.rooms = JSON.parse(rooms);
  }
  onSelected(room) {
    this.room = room;
    this.save = "";
  }
  onHasmember(has) {
    this.hasmember = has;
  }
  saveCTL(com) {
    if (com === "roomdone") {
      this.roomTree.getNode();
      this.save = "";
      this.exec = "";
    } else if (com === "done") {
      this.save = ""; this.exec = "";
    } else {
      this.save = com;
    }
  }
  undo() {
    if (this.save === "saveroom") {
      this.exec = "undoroom";
    } else if (this.save === "savestory") {
      this.exec = "undostory";
    }
  }
  exit() {
    this.data.owner = false;
  }
  get barColor() {
    let color;
    if (this.save) {
      color = "purple";
    } else if (this.room.shut === 100) {
      color = "grey";
    } else if (this.room.price > 0) {
      color = "green";
    } else if (!this.user.id) {
      color = "red";
    } else {
      return {};
    }
    return { 'background-color': color }
  }
}
export class Room {
  constructor(public id?: number,
    public parent?: number,
    public na?: string,
    public idx?: number,
    public discription?: string,
    public price?: number,
    public chat?: number,
    public story?: number,
    public shut?: number,
    public plan?: number,
    public prorate?: number,
    public auth?: number,
    public amount?: number,
    public billing_day?: number,
    public trial_days?: number,
    public auth_days?: number
  ) {
  }
}