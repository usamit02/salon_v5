import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpRequest, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { APIURL } from '../../environments/environment';
import { UiService } from './ui.service';
@Injectable({
  providedIn: 'root'
})
export class ApiService {
  token: string = "";
  constructor(private http: HttpClient, private ui: UiService) { }
  getm(url: string, params: any): Observable<Object> {
    return this.http.get(APIURL + url + ".php", { params: params });
  }
  get(url: string, params: any, msg?: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (msg) this.ui.loading(msg + "...");
      let php = this.http.get(APIURL + url + ".php", { params: params }).subscribe((res: any) => {
        if (msg) this.ui.loadend();
        php.unsubscribe();
        let a = url.substr(0, 5);
        if (res.msg === "ok" || url.substr(0, 5) === "owner") {
          resolve(res);
        } else {
          this.ui.alert(res.msg);
          reject();
        }
      }, (error) => {
        this.ui.alert("通信エラー  \r\n" + error.message);
        reject();
      });
    });
  }
  request(url: string, method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      let request: HttpRequest<any>;
      if (method === "get") {
        let body;
        body.append({ params: params });
        if (this.token) {
          body = body.append({ headers: new HttpHeaders({ Authorization: "Bearer ${token}" }) });
        }
        request = new HttpRequest('get', "http://localhost:8000/api/" + url, body);
      } else {
        let body = new HttpParams; let options;
        for (const key of Object.keys(params)) {
          body = body.append(key, params[key]);
        }
        if (this.token) {
          options = options.append({ headers: new HttpHeaders({ Authorization: "Bearer ${token}" }) });
        }
        request = new HttpRequest(method, "http://localhost:8000/api/" + url, body);
      }
      let req = this.http.request(request).subscribe((res: any) => {
        if (res.token) this.token = res.token;
        resolve(res);
      }, (error) => {
        this.ui.alert("通信エラー  \r\n" + error.message);
        reject();
      });
    });
  }
  gets(url: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      let body = { params: params, headers: new HttpHeaders({ "Authorization": "Bearer " + this.token }) };
      let headers: HttpHeaders = new HttpHeaders();
      headers = headers.append("Authorization", "Bearer " + this.token);
      let req = this.http.get("http://localhost:8000/api/" + url, { headers }).subscribe((res: any) => {
        req.unsubscribe();
        if (res.token) this.token = res.token;
        resolve(res);
      }, (error) => {
        this.ui.alert("通信エラー  \r\n" + error.message);
        reject();
      });
    });
  }
  posts(url: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      let body = new HttpParams; let options;
      for (const key of Object.keys(params)) {
        body = body.append(key, params[key]);
      }
      if (this.token) {
        options = options.append({ headers: new HttpHeaders({ "Authorization": "Bearer " + this.token }) });
      }
      let req = this.http.post("http://localhost:8000/api/" + url, body, options).subscribe((res: any) => {
        req.unsubscribe();
        if (res.token) this.token = res.token;
        resolve(res);
      }, (error) => {
        this.ui.alert("通信エラー  \r\n" + error.message);
        reject();
      });
    });
  }
  post(url: string, params: any): Observable<Object> {
    let body = new HttpParams;
    for (const key of Object.keys(params)) {
      body = body.append(key, params[key]);
    }
    return this.http.post(APIURL + url + ".php", body, {
      headers: new HttpHeaders({ "Content-Type": "application/x-www-form-urlencoded" })
    });
  }
  upload(url: string, formData: any): Observable<Object> {
    let fd = new FormData;
    for (const key of Object.keys(formData)) {
      fd.append(key, formData[key]);
    }
    let params = new HttpParams();
    const req = new HttpRequest('POST', APIURL + url + ".php", fd, { params: params, reportProgress: true });
    return this.http.request(req);
    //return this.http.post(this.url + url, fd, { reportProgress: true,observe:'events' });
  }

}
/*




*/