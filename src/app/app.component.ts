import { Component } from '@angular/core';
import { DataService } from './service/data.service';
@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html'
})
export class AppComponent {
  constructor(
    public data: DataService,
  ) {
  }
}
