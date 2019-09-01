import { Component, Input, OnInit, EventEmitter, Output, ViewChild } from '@angular/core';
import { TREE_ACTIONS, KEYS, ITreeOptions, TreeNode, TreeModel, TreeDropDirective } from 'angular-tree-component';
import { Room } from '../owner.component';
import { ApiService } from '../../service/api.service';
declare var $;
@Component({
  selector: 'app-members',
  templateUrl: './members.component.html',
  styleUrls: ['./members.component.scss'],
})
export class MembersComponent implements OnInit {
  @Input()
  set room(room: Room) {
    this.contextMenu = null;
    this.getNode(room);
    this._room = room;
  }
  get room() {
    return this._room;
  }
  @Input() user;
  @Output() selected = new EventEmitter<Room>();
  @Output() hasmember = new EventEmitter<boolean>();
  @ViewChild('tree', { static: false }) tree;
  private _room: Room;
  users: string;
  rooms = [];
  nodes = [];
  remainRate: number;
  options: ITreeOptions = {
    displayField: 'na',
    isExpandedField: 'expanded',
    idField: 'id',
    hasChildrenField: 'nodes',
    actionMapping: {
      mouse: {
        dblClick: (tree: TreeModel, node: TreeNode, e: MouseEvent) => {
          if (node.hasChildren) TREE_ACTIONS.TOGGLE_EXPANDED(tree, node, e);
        },
        contextMenu: (tree: TreeModel, node: TreeNode, e: MouseEvent) => {
          e.preventDefault();
          if (this.contextMenu && node === this.contextMenu.node ||
            (!this.doCut && node.data.id >= 0 && !(node.data.id === 1 && node.hasChildren)) ||
            ('room' in node.data && node.data.room !== this.room.id) ||
            ('auth' in node.data && node.data.auth > this.room.auth) ||
            !('auth' in node.data) && node.data.id > this.room.auth) {
            return this.contextMenu = null;
          }
          this.contextMenu = {
            node: node,
            x: 100,
            y: e.pageY
          };
        },
        click: (tree: TreeModel, node: TreeNode, e: MouseEvent) => {
          this.contextMenu = null;
          this.selected.emit(node.data);
          TREE_ACTIONS.TOGGLE_ACTIVE(tree, node, e);
        },
        drop: (tree: TreeModel, node: TreeNode, e: MouseEvent, { from, to }) => {
          if (!(node.data.id > 0)) node = node.parent;
          if (node.parent && node.data.id > 10 && node.data.id <= this.room.auth) {
            tree.moveNode(from, { parent: node, index: to.index });
            nodeNum(this.tree);
            this.tree.treeModel.update();
            this.change = true;
          } else {
            alert("そこには移動できません。");
          }
        }

      },
      keys: {
        [KEYS.ENTER]: (tree, node, $event) => {
          node.expandAll();
        }
      }
    },
    nodeHeight: 23,
    allowDrag: (node) => {
      if (node.id >= 0) {
        return false;
      } else {
        if (node.data.room === this.room.id && node.data.auth <= this.room.auth) {
          return true;
        } else {
          return false;
        }
      }
    },
    allowDrop: (node) => {
      return true;
    }
  }
  contextMenu: { node: TreeNode, x: number, y: number } = null;
  sourceNode: TreeNode = null;
  editNode: TreeNode = null;
  doCut = false;
  change = false;
  //closeMenu = () => {this.contextMenu = null;}
  cut = () => {
    this.sourceNode = this.contextMenu.node;
    this.doCut = true;
    this.contextMenu = null;
  }
  paste = () => {
    if (!this.canPaste()) {
      return;
    }
    if (this.doCut) {
      this.sourceNode.treeModel.moveNode(this.sourceNode, { parent: this.contextMenu.node, index: 9999999999999 });
      this.doCut = false;
    }
    this.sourceNode = null;
    this.change = true;
    nodeNum(this.tree);
    this.contextMenu = null;
  }
  canPaste = () => {
    if (!this.sourceNode) {
      return false;
    }
    return this.sourceNode.treeModel.canMoveNode(this.sourceNode, { parent: this.contextMenu.node, index: 0 });
  }
  OK() {
    this.api.get("pay/roompay", { uid: this.contextMenu.node.data.id, rid: this.room.id, ok: this.user.id }).then((data: any) => {
      if (data.msg === "ok") {
        this.getNode(this.room);
      } else {
        alert(data.error);
      }
      this.contextMenu = null;
    });
  }
  NG(tree) {
    if (confirm("申し込みを却下してよろしいですか。\n※この操作は取り消しできません。")) {
      this.NGban(tree);
    }
  }
  ban(tree) {
    if (confirm("本人の意思にかかわらず退会させてよろしいですか。\n※この操作は取り消しできません。")) {
      this.NGban(tree);
    }
  }
  NGban(tree) {
    this.api.get("pay/roompay", { uid: this.contextMenu.node.data.id, rid: this.room.id, ban: this.user.id }).then((data: any) => {
      if (data.msg === "ok") {
        this.del(tree);
        this.change = false;
      } else {
        alert(data.error + "\nC-Lifeまでお問合せください。");
      }
      this.contextMenu = null;
    });
  }
  banall(tree) {
    if (confirm("全てのメンバーを退会させてサロンを解散しますか。\n※この操作は取り消しできません。")) {
      this.api.get("pay/ban", { rid: this.room.id, ban: this.user.id }).then((data: any) => {
        if (data.msg === "ok") {
          this.del(tree);
          this.change = false;
        } else {
          alert(data.error + "\nC-Lifeまでお問合せください。");
        }
        this.contextMenu = null;
      });
    }
  }
  del = (tree) => {
    let node = this.contextMenu.node;
    let parentNode = node.realParent ? node.realParent : node.treeModel.virtualRoot;
    parentNode.data.children = parentNode.data.children.filter(child => { return child !== node.data; });//  _.remove(parentNode.data.children, function (child) { return child === node.data;});
    nodeNum(tree);
    tree.treeModel.update();
    this.contextMenu = null;
    this.change = true;
  }
  rate = () => {
    let rate = Number($(".menu input").val());
    if (rate < 0 || rate > this.remainRate + this.contextMenu.node.data.rate) {
      alert("0から" + this.remainRate + "までの配分率を入力。\n多くしたいときは他の人の配分率を減らして。");
    } else {
      this.remainRate += this.contextMenu.node.data.rate - rate;
      this.contextMenu.node.data.rate = rate;
      this.contextMenu = null;
      this.change = true;
    }
  }
  filterFn(value: string, treeModel: TreeModel) {
    treeModel.filterNodes((node: TreeNode) => fuzzysearch(value, node.data.name));
  }
  undo() {
    this.getNode(this.room);
    this.change = false;
  }
  save(treeModel: TreeModel) {
    var nodes = [];
    for (let i = treeModel.nodes.length; i > 0; i--) {
      let node = treeModel.nodes[i - 1];
      if (node.id > 9 && node.id < 10000 && "children" in node) {
        for (let j = 0; j < node.children.length; j++) {
          let child = node.children[j];
          if (child.room === this.room.id && !nodes.filter(node => { return node.id === child.id; }).length) {
            child.auth = treeModel.nodes[i - 1].id;
            child.idx = j;
            nodes.push(child);
          }
        }
      }
    }
    var sql = "";
    var users = JSON.parse(this.users);
    users = users.filter(user => { return user.room === this.room.id && user.auth > 9; });
    nodes.forEach((node) => {
      let user = users.filter(user => { return user.id === node.id });
      if (user.length) {
        if (node.auth !== user[0].auth || node.idx !== user[0].idx || node.rate != user[0].rate) {
          sql += "UPDATE t03staff SET auth=" + node.auth + ",idx=" + node.idx + ",rate=" + node.rate +
            " WHERE uid='" + node.id + "' AND rid=" + node.room + ";\n";
        }
        users = users.filter(user => { return user.id !== node.id; });
      } else {
        sql += "INSERT INTO t03staff (uid,rid,auth,idx,rate,upd) VALUES ('"
          + node.id + "'," + node.room + "," + node.auth + "," + node.idx + "," + node.rate + "," + dateFormat() + ");\n";
      }
    });
    for (let i = 0; i < users.length; i++) {
      sql += "DELETE FROM t03staff WHERE uid='" + users[i].id + "' AND rid=" + users[i].room + ";\n";
    }
    console.log(sql);
    if (sql) {
      this.api.get("owner/save", { sql: sql.substr(0, sql.length - 1) }).then((data: any) => {
        if (data.msg === "ok") {
          this.getNode(this.room);
        } else {
          alert("データベースエラー C-Lifeまでお問合せください。");
        }
      });
    }
    this.change = false;
  }
  constructor(private api: ApiService) { }

  ngOnInit() {

  }
  public getNode(room: Room) {
    this.api.get("owner/member", { room: room.id }).then((users: any) => {
      this.users = JSON.stringify(users);
      this.nodes = [
        { id: 0, na: "審査待ち", children: [] },
        { id: 1, na: "メンバー", children: [] },
        { id: 100, na: "アシスタント", children: [] },
        { id: 200, na: "マネージャー", children: [] },
        { id: 500, na: "クリエイター", children: [] },
        { id: 1000, na: "マスター", children: [] },
        { id: 9000, na: "オーナー", children: [] },
        {
          id: 9999, children: [
            { id: 10000, na: "検索した人をドラッグして役職や会員に追加できます。" }
          ]
        }
      ]
      this.remainRate = 100;
      this.nodes.forEach(node => {
        let children = users.filter(user => { return user.auth === node.id; });
        if (children.length) {
          children.forEach(child => {//if (children.some(child => { return child.id === this.user.id; })) {
            if (child.id === this.user.id) node.my = true;
            if (child.rate) this.remainRate -= child.rate;
          });
          node.children = children;
          node.num = '(' + children.length + ')';
        }
      });
      this.tree.treeModel.getNodeById(9999).expand();
      let members = users.filter(user => { return user.auth < 2 });
      this.hasmember.emit(members.length > 0);
    });
  }
  search(x: string) {
    this.api.get("owner/member", { search: x }).then((users: any) => {
      this.nodes[7].children = [];
      if (users.length === 50) {
        this.nodes[7].children.push({ id: 10000, na: "50人以上該当しています。\n全てを表示できません。" });
      }
      if (users.length) {
        for (let i = 0; i < users.length; i++) {
          let node = { id: users[i].id, na: users[i].na, avatar: users[i].avatar, room: this.room.id, auth: 0, rate: 0 };
          this.nodes[7].children.push(node);
        }
      } else {
        this.nodes[7].children.push({ id: 10000, na: "誰もいない..." });
      }
      this.tree.treeModel.update();
      this.tree.treeModel.getNodeById(9999).expand();
    });
  }
  clearSearch() {
    let input = <HTMLInputElement>document.getElementById("search");
    input.value = "";
  }
}
function fuzzysearch(needle: string, haystack: string) {
  const haystackLC = haystack.toLowerCase();
  const needleLC = needle.toLowerCase();

  const hlen = haystack.length;
  const nlen = needleLC.length;

  if (nlen > hlen) {
    return false;
  }
  if (nlen === hlen) {
    return needleLC === haystackLC;
  }
  outer: for (let i = 0, j = 0; i < nlen; i++) {
    const nch = needleLC.charCodeAt(i);

    while (j < hlen) {
      if (haystackLC.charCodeAt(j++) === nch) {
        continue outer;
      }
    }
    return false;
  }
  return true;
}
function nodeNum(tree) {
  for (let i = 0; i < tree.treeModel.nodes.length; i++) {
    let num = tree.treeModel.nodes[i].children.length;
    tree.treeModel.nodes[i].num = num ? "(" + num + ")" : "";
  }
}
function dateFormat(date = new Date()) {//MySQL用日付文字列作成'yyyy-M-d H:m:s'
  var y = date.getFullYear();
  var m = date.getMonth() + 1;
  var d = date.getDate();
  var h = date.getHours();
  var min = date.getMinutes();
  var sec = date.getSeconds();
  return "'" + y + "-" + m + "-" + d + " " + h + ":" + min + ":" + sec + "'";
}
