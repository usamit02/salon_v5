import { Component, OnInit } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/auth';
import { DataService } from '../../service/data.service';
import { UiService } from '../../service/ui.service';
import { APIURL } from '../../../environments/environment';
@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent implements OnInit {
  email: string = "";
  password: string = "";
  na: string = "";
  mode: string = "login";
  constructor(private afAuth: AngularFireAuth, private ui: UiService, private data: DataService, ) { }
  ngOnInit() { }
  login() {
    this.afAuth.auth.signInWithEmailAndPassword(this.email, this.password).catch(err => {
      this.ui.alert("ログインに失敗しました。\r\n" + err.toString());
    });
  }
  regist() {
    this.afAuth.auth.createUserWithEmailAndPassword(this.email, this.password).then(userCred => {
      let user = { uid: userCred.user.uid, displayName: this.na, photoURL: APIURL + "img/avatar.jpg" };
      this.data.login(user);
    }).catch(err => {
      this.ui.alert("登録失敗しました。\r\n" + err.toString());
    });
  }
}
