import { Component, OnInit, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { ApiService } from '../../service/api.service';
import { TREE_ACTIONS, KEYS, ITreeOptions, TreeNode, TreeModel, TreeDropDirective } from 'angular-tree-component';
import { Room } from '../owner.component';
import { AngularFirestore } from '@angular/fire/firestore';
import { AngularFireStorage } from '@angular/fire/storage';
@Component({
  selector: 'app-rooms',
  templateUrl: './rooms.component.html',
  styleUrls: ['./rooms.component.scss'],
})
export class RoomsComponent implements OnInit {
  @Input() user;
  @Output() getrooms = new EventEmitter();
  @Output() selected = new EventEmitter<Room>();
  @ViewChild('tree', { static: false }) tree;
  rooms = [];
  nodes = [];
  room: string;
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
          if (this.contextMenu && node === this.contextMenu.node) {
            return this.closeMenu();
          }
          this.contextMenu = {
            node: node,
            x: e.pageX,
            y: e.pageY
          };
        },
        click: (tree: TreeModel, node: TreeNode, e: MouseEvent) => {
          this.closeMenu();
          this.selected.emit(node.data);
          TREE_ACTIONS.TOGGLE_ACTIVE(tree, node, e);
        },
        drop: (tree: TreeModel, node: TreeNode, e: MouseEvent, { from, to }) => {
          if (node.parent && to.parent.data.auth >= 1000) {
            if (from.data.auth >= 1000) {
              tree.moveNode(from, { parent: node, index: to.index });
              this.change = true;
            } else {
              if (confirm("「" + from.displayName + "」を移動する権限がありません。コピーしますか。")) {
                tree.copyNode(from, { id: 999, parent: node, index: to.index });
                this.change = true;
              }
            }

          } else {
            alert("権限がありません。");
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
      return true;
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
  closeMenu = () => {
    this.contextMenu = null;
  }
  copy = () => {
    this.sourceNode = this.contextMenu.node;
    this.doCut = false;
    this.closeMenu();
  }
  cut = () => {
    this.sourceNode = this.contextMenu.node;
    this.doCut = true;
    this.closeMenu();
  }
  paste = () => {
    if (!this.canPaste()) {
      return;
    }
    this.doCut
      ? this.sourceNode.treeModel.moveNode(this.sourceNode, { parent: this.contextMenu.node, index: 9999999999999 })
      : this.sourceNode.treeModel.copyNode(this.sourceNode, { id: 999, parent: this.contextMenu.node, index: 9999999999999 });
    this.sourceNode = null;
    this.change = true;
    this.closeMenu();
  }
  canPaste = () => {
    if (!this.sourceNode) {
      return false;
    }
    return this.sourceNode.treeModel.canMoveNode(this.sourceNode, { parent: this.contextMenu.node, index: 0 });
  }
  edit = () => {
    this.editNode = this.contextMenu.node;
    this.closeMenu();
  }
  saveEdit = () => {
    this.change = true;
    this.editNode = null;
  }
  stopEdit = () => {
    this.editNode = null;
  }
  add = (tree) => {
    let node = this.contextMenu.node;
    this.api.get("owner/room", { parent: node.id }).then((data: any) => {//新しい部屋を追加してidを取得
      if (data.maxId) {
        let room = new Room(data.maxId, node.id, "新しい部屋", 0, "", 0, 0, 0, 0, 0);
        let rooms = JSON.parse(this.room);
        rooms.push(room);
        this.room = JSON.stringify(rooms);
        room.price = getPrice(node.id, rooms);
        room.auth = node.data.auth;
        if (!node.data.children) node.data.children = [];
        node.data.children.push(room);
        tree.treeModel.update();
        tree.treeModel.getNodeById(node.id).expand();
        let editNode = tree.treeModel.getNodeById(data.maxId);
        this.editNode = editNode;
      } else {
        alert("データーベースエラーにより新しい部屋の作成に失敗しました。");
      }
    });
    this.closeMenu();
  }
  del = (tree) => {
    this.change = true;
    let node = this.contextMenu.node;
    let parentNode = node.realParent ? node.realParent : node.treeModel.virtualRoot;
    if (node.data.children && !confirm("下層部屋もまとめて削除しますか？")) {
      for (let i = 0; i < node.data.children.length; i++) {
        parentNode.data.children.push(node.data.children[i]);
      }
    }
    parentNode.data.children = parentNode.data.children.filter(child => { return child !== node.data; });//_.remove(parentNode.data.children, function (child) {return child === node.data;});    
    tree.treeModel.update();
    this.closeMenu();
    if (node.parent.data.children.length === 0) {
      node.parent.data.hasChildren = false;
    }
  }
  filterFn(value: string, treeModel: TreeModel) {
    treeModel.filterNodes((node: TreeNode) => fuzzysearch(value, node.data.name));
  }
  undo() {
    this.getNode();
    this.change = false;
  }
  save(treeModel: TreeModel) {
    let nodes = [];
    function addNodes(node) {
      if (node.children) {
        for (let i = 0; i < node.children.length; i++) {
          node.children[i].idx = i;
          node.children[i].folder = "children" in node.children[i] ? 1 : 0;
          node.children[i].parent = node.id;
          nodes.push(node.children[i]);
          addNodes(node.children[i]);
        }
      }
    }
    for (let i = 0; i < treeModel.nodes.length; i++) {
      //treeModel.nodes[i].idx = i;ルートノードは順番変更できない
      treeModel.nodes[i].folder = "children" in treeModel.nodes[i] ? 1 : 0;
      nodes.push(treeModel.nodes[i]);
      addNodes(treeModel.nodes[i]);
    }
    let sql = ""; let dels = [];
    let rooms = JSON.parse(this.room);
    let maxId = Math.max(...rooms.map(room => room.id));
    const noProp = ["auth", "children", "amount", "billing_day", "trial_days", "price"];
    nodes.forEach((node) => {
      let val = "";
      let room = rooms.filter(room => { return room.id == node.id });
      if (room.length) {
        for (const p of Object.keys(room[0])) {
          if (!noProp.filter(prop => { return p === prop; }).length && room[0][p] !== node[p]) {
            if ((p === "na" || p === "discription") && node[p] !== null) {
              val += p + '="' + node[p] + '",';
            } else {
              val += p + "=" + node[p] + ",";
            }
          }
        }
        sql += val ? "UPDATE t01room SET " + val.substr(0, val.length - 1) + " WHERE id=" + room[0].id + ";\n" : "";
        rooms = rooms.filter(room => { return room.id != node.id; });
      } else {
        let key = "";
        if (node.id > 100000000000) { maxId++; node.id = maxId; }
        for (const p of Object.keys(node)) {
          if (!noProp.filter(prop => { return p === prop; }).length) {
            key += p + ","
            if ((p == "na" || p == "discription") && !(node[p] === null || node[p] === "null")) {
              val += '"' + node[p] + '",';
            } else {
              val += node[p] + ",";
            }
          }
        }
        sql += "INSERT INTO t01room (" + key.substr(0, key.length - 1) + ") VALUES (" + val.substr(0, val.length - 1) + ");\n";
      }
    });
    for (let i = 0; i < rooms.length; i++) {
      dels.push(rooms[i].id);//sql += "DELETE FROM t01room WHERE id=" + rooms[i].id + ";\n";
    }
    //console.log(sql);
    this.api.get("owner/room", {
      uid: this.user.id, sql: sql.substr(0, sql.length - 1), dels: JSON.stringify(dels)
    }).then((data: any) => {
      if (data.msg === "ok") {
        this.change = false;
        this.getNode();
        for (let i = 0; i < dels.length; i++) {
          let dbcon = this.db.collection("room").doc(dels[i].toString()).collection('chat');
          dbcon.get().subscribe(query => {
            query.forEach(doc => {
              let img = doc.data().img;
              if (img) {
                this.storage.ref("room/" + dels[i] + "/" + img).delete();
                this.storage.ref("room/" + dels[i] + "/org/" + img).delete();
              }
              dbcon.doc(doc.id).delete();
            });
          });
          this.db.collection("room").doc(dels[i].toString()).delete();
        }
      } else {
        alert("データベースエラー C-Lifeまでお問合せください。\n" + data.msg);
      }
    });
  }
  constructor(private api: ApiService, private db: AngularFirestore, private storage: AngularFireStorage) { }

  ngOnInit() {

  }
  ngOnChanges() {
    this.getNode();
  }
  public getNode() {
    this.api.get("owner/room", { uid: this.user.id }).then((rooms: any) => {
      this.nodes = [];
      var allRooms = [];
      for (let i = 0; i < rooms.length; i++) {
        allRooms = allRooms.concat(rooms[i]);
        let res = addRooms(rooms[i][0].id, rooms[i], rooms[i][0].auth, rooms[i][0].shut);
        if (res.length) rooms[i][0].children = res;
        this.nodes.push(rooms[i][0]);
      }
      this.room = JSON.stringify(allRooms);
      this.getrooms.emit(this.room);
    });
    function addRooms(parent, rooms, auth, shut) {
      var childs = [];
      let children = rooms.filter(node => { return node.parent === parent; });
      for (let i = 0; i < children.length; i++) {
        children[i].price = getPrice(children[i].parent, rooms);
        if (children[i].auth === null || children[i].auth < auth) {
          children[i].auth = auth;
        }
        if (children[i].shut === null || shut > 99 && children[i].shut < shut) {
          children[i].shut = shut;
        }
        let res = addRooms(children[i].id, rooms, children[i].auth, children[i].shut);
        if (res.length) { children[i].children = res; }
        childs.push(children[i]);
      }
      return childs;
    }
  }
}
function getPrice(parent, rooms) {
  var price = 0;
  do {
    let parents = rooms.filter(room => { return room.id === parent; });
    if (parents.length) {
      price += parents[0].amount ? parents[0].amount : 0;
      parent = parents[0].id;
    }
  } while (parent.length)
  return price;
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
