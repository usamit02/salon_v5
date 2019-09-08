import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouteReuseStrategy } from '@angular/router';
import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { SplashScreen } from '@ionic-native/splash-screen/ngx';
import { StatusBar } from '@ionic-native/status-bar/ngx';
import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { LayoutModule } from '@angular/cdk/layout';
import { HttpClientModule } from '@angular/common/http'

import { MatToolbarModule, MatButtonModule, MatSidenavModule, MatIconModule, MatListModule, MatGridListModule, MatCardModule, MatMenuModule, MatTableModule, MatPaginatorModule, MatSortModule } from '@angular/material';
import { SocketIoModule } from 'ngx-socket-io';
import { AngularFireModule } from '@angular/fire';
import { AngularFireAuthModule } from '@angular/fire/auth';
import { AngularFirestoreModule } from '@angular/fire/firestore';
import { AngularFireStorageModule } from '@angular/fire/storage';
import { socketConfig, firebaseConfig } from '../environments/environment';
import { TreeModule } from 'angular-tree-component';

import { SalonComponent } from './salon/salon.component';
import { HomeComponent } from './salon/home/home.component';
import { RoomComponent } from './salon/room/room.component';
import { MemberComponent } from './salon/member/member.component';
import { DetailComponent } from './salon/detail/detail.component';
import { CardComponent } from './salon/card/card.component';
import { StoryComponent } from './salon/story/story.component';
import { WebrtcComponent } from './salon/webrtc/webrtc.component';
import { NotifyComponent } from './salon/notify/notify.component';
import { LoginComponent } from './salon/login/login.component';

import { OwnerComponent } from './owner/owner.component';
import { MainComponent } from './owner/main/main.component';
import { MembersComponent } from './owner/members/members.component';
import { RoomsComponent } from './owner/rooms/rooms.component';
import { StorysComponent } from './owner/storys/storys.component';
import { NoticeComponent } from './owner/notice/notice.component';
import { BookComponent } from './owner/book/book.component';

import { DataService } from './service/data.service';
import { SafePipe } from './pipe/safe.pipe';
import { ChatdatePipe } from './pipe/chatdate.pipe';
import { MediaPipe } from './pipe/media.pipe';
import 'hammerjs';

@NgModule({
  declarations: [
    AppComponent, SafePipe, ChatdatePipe, MediaPipe,
    SalonComponent, HomeComponent, RoomComponent, MemberComponent, CardComponent, DetailComponent, StoryComponent, WebrtcComponent, NotifyComponent, LoginComponent,
    OwnerComponent, MainComponent, RoomsComponent, MembersComponent, StorysComponent, NoticeComponent, BookComponent,
  ],
  entryComponents: [MemberComponent, LoginComponent],
  imports: [BrowserModule,
    IonicModule.forRoot(),
    AppRoutingModule,
    HttpClientModule,
    AppRoutingModule,
    SocketIoModule.forRoot(socketConfig),
    AngularFireModule.initializeApp(firebaseConfig),
    AngularFireAuthModule,
    AngularFirestoreModule,
    AngularFireStorageModule,
    FormsModule,
    ReactiveFormsModule,
    NoopAnimationsModule,
    LayoutModule,
    MatToolbarModule,
    MatButtonModule,
    MatSidenavModule,
    MatIconModule,
    MatListModule,
    MatGridListModule,
    MatCardModule,
    MatMenuModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    TreeModule.forRoot(),
  ],
  providers: [
    StatusBar,
    SplashScreen,
    DataService,
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
