import { Pipe, PipeTransform } from '@angular/core';
@Pipe({
  name: 'chatdate'
})
export class ChatdatePipe implements PipeTransform {
  constructor() { }
  transform(date: Date, type: string = "chat"): string {
    date = new Date(date);
    let todate = new Date();
    let nextdate = new Date();
    const diff = new Date().getTime() - date.getTime();
    switch (type) {
      case 'chat':
        if (diff < 60000) {//1分以内
          return "今";
        } else if (diff < 600000) {//10分以内
          return Math.floor(diff / 60000) + "分前";
        }
        const h = date.getHours();
        const m = date.getMinutes();
        todate.setHours(0, 0, 0, 0);//今日の0時  
        nextdate.setDate(todate.getDate() - 1);
        if (date > nextdate) {
          if (date > todate) {
            return "今日 " + h + "時" + m + "分";
          } else {
            return "昨日 " + h + "時" + m + "分";
          }
        }
        return (date.getMonth() + 1) + "月" + date.getDate() + "日 " + h + "時" + m + "分";
      case 'detail':
        if (diff > 0) {
          todate.setHours(0, 0, 0, 0);//今日の0時  
          nextdate.setDate(todate.getDate() - 1);
          if (date > nextdate) {
            if (date > todate) {
              return "今日";
            } else {
              return "昨日";
            }
          } else if (diff < 10 * 8640000) {//10日前まで
            return Math.floor(diff / 86400000).toString() + "日前";
          }
        } else {
          todate.setHours(0, 0, 24, 0);//今日の24時  
          nextdate.setDate(todate.getDate() - 1);
          if (date < nextdate) {
            if (date < todate) {
              return "今日";
            } else {
              return "明日";
            }
          } else if (diff > 10 * 8640000) {//10日後まで
            return Math.ceil(diff / 86400000).toString() + "日後";
          }
        }
        let nowYear = new Date(todate.getFullYear(), 0, 1);
        if (date > nowYear) {
          return (date.getMonth() + 1) + "月" + date.getDate() + "日";
        } else {
          return date.getFullYear() + "年" + (date.getMonth() + 1) + "月" + date.getDate() + "日";
        }

      default: throw new Error(`Invalid safe type specified: ${type}`);
    }
  }

}