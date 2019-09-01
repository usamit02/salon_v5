import { Component, OnInit, Input, ViewChild } from '@angular/core';
import { ApiService } from '../../service/api.service';
import { MatPaginator, MatTableDataSource } from '@angular/material';
@Component({
  selector: 'app-book',
  templateUrl: './book.component.html',
  styleUrls: ['./book.component.scss']
})
export class BookComponent implements OnInit {
  displayedColumns: string[] = ['rqd', 'upd', 'room', 'amount'];
  data;
  pageSize: number = 25;
  pageSizeOptions: number[] = [20, 50, 100];
  pager;
  fee: number = 0;
  bank = { na: "", branch: "", acctyp: "", accnum: null };
  inputBank: boolean = true;
  @Input() user;
  @ViewChild(MatPaginator, { static: false }) paginator: MatPaginator;
  constructor(private api: ApiService) { }

  ngOnInit() {

  }
  ngOnChanges() {
    if (this.user.id) {
      this.api.get("owner/book", { uid: this.user.id }).then((data: any) => {
        this.data = new MatTableDataSource(data.book);
        this.data.paginator = this.paginator;
        this.pager = data.book.length < 25 ? true : false;
        if (data.bank) {
          this.bank = data.bank;
          this.inputBank = false;
        }
      });
    }
  }
  culcFee(e) {
    let amount = Number(e.currentTarget.value);
    if (amount > this.user.p) {
      alert("現在残高" + this.user.p + "ポイントまでしか請求できません。");
      amount = this.user.p;
    }
    this.fee = Math.ceil(amount * 0.08 + 324);
  }
  request() {
    let input = <HTMLInputElement>document.getElementById('amount');
    let amount = Number(input.value);
    if (amount > this.user.p) {
      alert("現在残高" + this.user.p + "ポイントまでしか請求できません。");
      input.value = this.user.p;
    } else if (amount < 1000) {
      alert("出金請求は1000ポイントから可能です。");
      input.value = "1000";
    } else if (!this.bank.na) {
      alert("振込先の銀行口座を登録してください。");
    } else {
      this.api.get("owner/book", { uid: this.user.id, amount: amount }).then((res: any) => {
        if (res.msg === 'ok') {
          alert(amount + "ポイントを出金請求しました。\nシステム手数料" + this.fee + "円を差し引いた" + (amount - this.fee) + "円が振り込まれます。");
          input.value = "0";
          this.user.p -= amount;
        } else {
          alert(res.msg);
        }
      });
    }
  }
  newBank() {
    this.bank = { na: "", branch: "", acctyp: "", accnum: null };
    this.inputBank = true;
  }
  setBank() {
    this.api.get("owner/book", { uid: this.user.id, bank: JSON.stringify(this.bank) }).then((res: any) => {
      if (res.msg === 'ok') {
        this.inputBank = false;
      } else {
        alert(res.msg);
      }
    });
  }
}
