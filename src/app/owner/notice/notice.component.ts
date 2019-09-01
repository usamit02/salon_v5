import { Component, OnInit, Input, ViewChild } from '@angular/core';
import { ApiService } from '../../service/api.service';
import { MatPaginator, MatTableDataSource } from '@angular/material';
@Component({
  selector: 'app-notice',
  templateUrl: './notice.component.html',
  styleUrls: ['./notice.component.scss']
})
export class NoticeComponent implements OnInit {
  displayedColumns: string[];
  data = new MatTableDataSource<PeriodicElement>(DUMMY);
  pageSize: number;
  pageSizeOptions: number[];
  pager;
  @Input() rooms;
  @Input() user;
  @Input() room;
  @ViewChild(MatPaginator, { static: false }) paginator: MatPaginator;
  constructor(private api: ApiService) { }

  ngOnInit() {

  }
  ngOnChanges() {
    if (this.user.id) {
      let rooms;
      if (this.room.id === 0 && this.rooms.length) {
        rooms = this.rooms.map(room => { return { id: room.id, plan: room.plan }; });
        this.pageSize = 20;
        this.pageSizeOptions = [20, 50, 100];
        this.displayedColumns = ['day', 'room', 'msg'];
      } else {
        rooms = [{ id: this.room.id, plan: this.room.plan }];
        this.pageSize = 5;
        this.pageSizeOptions = [5, 20, 50];
        this.displayedColumns = ['day', 'msg'];
      }
      this.api.post("owner/notice", { uid: this.user.id, rooms: JSON.stringify(rooms) }).subscribe((data: any) => {
        this.data = new MatTableDataSource(data);
        this.data.paginator = this.paginator;
        this.pager = data.length < 5 ? true : false;
      });
    }
  }
}
const DUMMY: PeriodicElement[] = [{ day: "", room: "", msg: "読み込み中..." }]
interface PeriodicElement {
  day: string;
  room: string;
  msg: string;
} 