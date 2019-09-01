import { Pipe, PipeTransform } from '@angular/core';
import { DataService } from '../service/data.service';
@Pipe({
  name: 'media'
})
export class MediaPipe implements PipeTransform {
  constructor(private data: DataService) { }
  transform(value: any, type: string): string {
    switch (type) {
      case 'img': return 'https://firebasestorage.googleapis.com/v0/b/blogersguild1.appspot.com/o/'
        + encodeURIComponent("room/" + this.data.room.id + "/" + value) + '?alt=media';
      case 'imgorg': return 'https://firebasestorage.googleapis.com/v0/b/blogersguild1.appspot.com/o/'
        + encodeURIComponent("room/" + this.data.room.id + "/org/" + value) + '?alt=media';
      case 'youtubeimg': return 'http://i.ytimg.com/vi/' + value + '/default.jpg';
      case 'youtube': return 'https://youtube.com/watch?v=' + value;
      case 'twitter': return '<blockquote class="twitter-tweet" data-conversation="none"><a href="https://'
        + value + '"></a></blockquote>';
      case 'react':
        let html: string = "";
        Object.keys(value).forEach(id => {
          html += '<span class="react">' + value[id].emoji + '<span style="display:none;">' + value[id].na + '</span></span>';
        });
        return html;
      case 'card': return '<div style="border-style:groove; border-radius: 10px;"><div><a href="' + value.url + '" target="_blank"><img style="max-height:200px;"src="'
        + value.image + '"></a></div><div><a href="' + value.url + '" target="_blank">' + value.title + '</a><p>' + value.description + '</p></div></div>';
      default: throw new Error(`Invalid safe type specified: ${type}`);
    }
  }

}