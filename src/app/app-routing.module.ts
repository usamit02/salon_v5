import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './salon/home/home.component';
import { RoomComponent } from './salon/room/room.component';
import { NotifyComponent } from './salon/notify/notify.component';
import { DetailComponent } from './salon/detail/detail.component';
//import { SalonComponent } from './salon/salon.component';

const routes: Routes = [
  { path: '', redirectTo: 'home/room/1', pathMatch: 'full' },
  {
    //path: 'home', loadChildren: './home/home.module#HomePageModule',
    path: 'home', component: HomeComponent,
    children: [
      { path: 'room/:id/:csd', component: RoomComponent },
      { path: 'room/:id', component: RoomComponent }
    ]
  },
  { path: 'notify', component: NotifyComponent },
  { path: 'detail/:no', component: DetailComponent },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
