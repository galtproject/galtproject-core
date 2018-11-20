/*
 * Copyright ©️ 2018 Galt•Space Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka),
 * [Dima Starodubcev](https://github.com/xhipster),
 * [Valery Litvin](https://github.com/litvintech) by
 * [Basic Agreement](http://cyb.ai/QmSAWEG5u5aSsUyMNYuX2A2Eaz4kEuoYWUkVBRdmu9qmct:ipfs)).
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) and
 * Galt•Space Society Construction and Terraforming Company by
 * [Basic Agreement](http://cyb.ai/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS:ipfs)).
 */

import "../utils/PointUtils.sol";

pragma solidity 0.4.24;
pragma experimental "v0.5.0";

library RedBlackTree {
  struct Item {
    uint parent;
    uint left;
    uint right;
    bool red;
  }

  struct Tree {
    uint root;
    mapping(uint => Item) items;
    uint inserted;
    uint removed;
  }

  uint internal constant ZERO = 0;

  event Log(string where, string action, uint key, uint parent, uint left, uint right, bool red);

  function count(Tree storage tree) internal view returns (uint _count) {
    return tree.inserted >= tree.removed ? tree.inserted - tree.removed : 0;
  }

  function first(Tree storage tree) internal view returns (uint _key) {
    _key = tree.root;
    while (_key != ZERO && tree.items[_key].left != ZERO) {
      _key = tree.items[_key].left;
    }
  }

  function last(Tree storage tree) internal view returns (uint _key) {
    _key = tree.root;
    while (_key != ZERO && tree.items[_key].right != ZERO) {
      _key = tree.items[_key].right;
    }
  }

  function next(Tree storage tree, uint x) internal view returns (uint y) {
    if (x == 0) {
      return 0;
    }
    if (tree.items[x].right != ZERO) {
      y = treeMinimum(tree, tree.items[x].right);
    } else {
      y = tree.items[x].parent;
      uint resultX = x;
      while (y != ZERO && resultX == tree.items[y].right) {
        resultX = y;
        y = tree.items[y].parent;
      }
    }
    return y;
  }

  function prev(Tree storage tree, uint x) internal view returns (uint y) {
    if (x == 0) {
      return 0;
    }
    if (tree.items[x].left != ZERO) {
      y = treeMaximum(tree, tree.items[x].left);
    } else {
      y = tree.items[x].parent;
      uint resultX = x;
      while (y != ZERO && resultX == tree.items[y].left) {
        resultX = y;
        y = tree.items[y].parent;
      }
    }
    return y;
  }

  //  function exists(Tree storage tree, uint key) internal view returns (bool _exists) {
  //    require(key != ZERO);
  //    uint _key = tree.root;
  //    while (_key != ZERO) {
  //      if (key == _key) {
  //        _exists = true;
  //        return;
  //      }
  //      if (key < _key) {
  //        _key = tree.items[_key].left;
  //      } else {
  //        _key = tree.items[_key].right;
  //      }
  //    }
  //  }

  function parent(Tree storage tree, uint key) internal view returns (uint _parent) {
    if (key == 0) {
      return 0;
    }
    _parent = tree.items[key].parent;
  }

  function grandparent(Tree storage tree, uint key) internal view returns (uint _grandparent) {
    if (key == 0) {
      return 0;
    }
    uint _parent = tree.items[key].parent;
    if (_parent != ZERO) {
      _grandparent = tree.items[_parent].parent;
    } else {
      _grandparent = ZERO;
    }
  }

  function sibling(Tree storage tree, uint key) internal view returns (uint _sibling) {
    if (key == 0) {
      return 0;
    }
    uint _parent = tree.items[key].parent;
    if (_parent != ZERO) {
      if (key == tree.items[_parent].left) {
        _sibling = tree.items[_parent].right;
      } else {
        _sibling = tree.items[_parent].left;
      }
    } else {
      _sibling = ZERO;
    }
  }

  function uncle(Tree storage tree, uint key) internal view returns (uint _uncle) {
    if (key == 0) {
      return 0;
    }
    uint _grandParent = grandparent(tree, key);
    if (_grandParent != ZERO) {
      uint _parent = tree.items[key].parent;
      _uncle = sibling(tree, _parent);
    } else {
      _uncle = ZERO;
    }
  }

  function remove(Tree storage tree, uint z) internal {
    require(z != ZERO, "id equals ZERO");
    uint x;
    uint y;

    // z can be root OR z is not root && parent cannot be the ZERO
    require(z == tree.root || (z != tree.root && tree.items[z].parent != ZERO), "z can be root OR z is not root && parent cannot be the ZERO");

    if (tree.items[z].left == ZERO || tree.items[z].right == ZERO) {
      y = z;
    } else {
      y = tree.items[z].right;
      while (tree.items[y].left != ZERO) {
        y = tree.items[y].left;
      }
    }
    if (tree.items[y].left != ZERO) {
      x = tree.items[y].left;
    } else {
      x = tree.items[y].right;
    }
    uint yParent = tree.items[y].parent;
    tree.items[x].parent = yParent;
    if (yParent != ZERO) {
      if (y == tree.items[yParent].left) {
        tree.items[yParent].left = x;
      } else {
        tree.items[yParent].right = x;
      }
    } else {
      tree.root = x;
    }
    bool doFixup = !tree.items[y].red;
    if (y != z) {
      replaceParent(tree, y, z);
      tree.items[y].left = tree.items[z].left;
      tree.items[tree.items[y].left].parent = y;
      tree.items[y].right = tree.items[z].right;
      tree.items[tree.items[y].right].parent = y;
      tree.items[y].red = tree.items[z].red;
      (y, z) = (z, y);
    }
    if (doFixup) {
      removeFixup(tree, x);
    }
    // Below `delete tree.items[ZERO]` may not be necessary
    // TODO - Remove after testing
    // emit Log("remove", "before delete tree.items[0]", 0, tree.items[0].parent, tree.items[0].left, tree.items[0].right, tree.items[0].red);
    // emit Log("remove", "before delete tree.items[ZERO]", ZERO, tree.items[ZERO].parent, tree.items[ZERO].left, tree.items[ZERO].right, tree.items[ZERO].red);
    if (tree.items[ZERO].parent != ZERO) {
      delete tree.items[ZERO];
    }
    delete tree.items[y];
    tree.removed++;
  }

  function treeMinimum(Tree storage tree, uint key) internal view returns (uint) {
    uint resultKey = key;
    while (tree.items[resultKey].left != ZERO) {
      resultKey = tree.items[resultKey].left;
    }
    return resultKey;
  }

  function treeMaximum(Tree storage tree, uint key) internal view returns (uint) {
    uint resultKey = key;
    while (tree.items[resultKey].right != ZERO) {
      resultKey = tree.items[resultKey].right;
    }
    return resultKey;
  }

  function rotateLeft(Tree storage tree, uint x) internal {
    uint y = tree.items[x].right;
    uint _parent = tree.items[x].parent;
    uint yLeft = tree.items[y].left;
    tree.items[x].right = yLeft;
    if (yLeft != ZERO) {
      tree.items[yLeft].parent = x;
    }
    tree.items[y].parent = _parent;
    if (_parent == ZERO) {
      tree.root = y;
    } else if (x == tree.items[_parent].left) {
      tree.items[_parent].left = y;
    } else {
      tree.items[_parent].right = y;
    }
    tree.items[y].left = x;
    tree.items[x].parent = y;
  }

  function rotateRight(Tree storage tree, uint x) internal {
    uint y = tree.items[x].left;
    uint _parent = tree.items[x].parent;
    uint yRight = tree.items[y].right;
    tree.items[x].left = yRight;
    if (yRight != ZERO) {
      tree.items[yRight].parent = x;
    }
    tree.items[y].parent = _parent;
    if (_parent == ZERO) {
      tree.root = y;
    } else if (x == tree.items[_parent].right) {
      tree.items[_parent].right = y;
    } else {
      tree.items[_parent].left = y;
    }
    tree.items[y].right = x;
    tree.items[x].parent = y;
  }

  /* solium-disable-next-line */
  function insertFixup(Tree storage tree, uint z) internal {
    uint y;

    while (z != tree.root && tree.items[tree.items[z].parent].red) {
      uint zParent = tree.items[z].parent;
      if (zParent == tree.items[tree.items[zParent].parent].left) {
        y = tree.items[tree.items[zParent].parent].right;
        if (tree.items[y].red) {
          tree.items[zParent].red = false;
          tree.items[y].red = false;
          tree.items[tree.items[zParent].parent].red = true;
          z = tree.items[zParent].parent;
        } else {
          if (z == tree.items[zParent].right) {
            z = zParent;
            rotateLeft(tree, z);
          }
          zParent = tree.items[z].parent;
          tree.items[zParent].red = false;
          tree.items[tree.items[zParent].parent].red = true;
          rotateRight(tree, tree.items[zParent].parent);
        }
      } else {
        y = tree.items[tree.items[zParent].parent].left;
        if (tree.items[y].red) {
          tree.items[zParent].red = false;
          tree.items[y].red = false;
          tree.items[tree.items[zParent].parent].red = true;
          z = tree.items[zParent].parent;
        } else {
          if (z == tree.items[zParent].left) {
            z = zParent;
            rotateRight(tree, z);
          }
          zParent = tree.items[z].parent;
          tree.items[zParent].red = false;
          tree.items[tree.items[zParent].parent].red = true;
          rotateLeft(tree, tree.items[zParent].parent);
        }
      }
    }
    tree.items[tree.root].red = false;
  }

  function replaceParent(Tree storage tree, uint a, uint b) internal {
    uint bParent = tree.items[b].parent;
    tree.items[a].parent = bParent;
    if (bParent == ZERO) {
      tree.root = a;
    } else {
      if (b == tree.items[bParent].left) {
        tree.items[bParent].left = a;
      } else {
        tree.items[bParent].right = a;
      }
    }
  }

  /* solium-disable-next-line */
  function removeFixup(Tree storage tree, uint x) internal {
    uint w;
    while (x != tree.root && !tree.items[x].red) {
      uint xParent = tree.items[x].parent;
      if (x == tree.items[xParent].left) {
        w = tree.items[xParent].right;
        if (tree.items[w].red) {
          tree.items[w].red = false;
          tree.items[xParent].red = true;
          rotateLeft(tree, xParent);
          w = tree.items[xParent].right;
        }
        if (!tree.items[tree.items[w].left].red && !tree.items[tree.items[w].right].red) {
          tree.items[w].red = true;
          x = xParent;
        } else {
          if (!tree.items[tree.items[w].right].red) {
            tree.items[tree.items[w].left].red = false;
            tree.items[w].red = true;
            rotateRight(tree, w);
            w = tree.items[xParent].right;
          }
          tree.items[w].red = tree.items[xParent].red;
          tree.items[xParent].red = false;
          tree.items[tree.items[w].right].red = false;
          rotateLeft(tree, xParent);
          x = tree.root;
        }
      } else {
        w = tree.items[xParent].left;
        if (tree.items[w].red) {
          tree.items[w].red = false;
          tree.items[xParent].red = true;
          rotateRight(tree, xParent);
          w = tree.items[xParent].left;
        }
        if (!tree.items[tree.items[w].right].red && !tree.items[tree.items[w].left].red) {
          tree.items[w].red = true;
          x = xParent;
        } else {
          if (!tree.items[tree.items[w].left].red) {
            tree.items[tree.items[w].right].red = false;
            tree.items[w].red = true;
            rotateLeft(tree, w);
            w = tree.items[xParent].left;
          }
          tree.items[w].red = tree.items[xParent].red;
          tree.items[xParent].red = false;
          tree.items[tree.items[w].left].red = false;
          rotateRight(tree, xParent);
          x = tree.root;
        }
      }
    }
    tree.items[x].red = false;
  }

  function pop(Tree storage tree) internal returns (uint) {
    if (tree.root == 0) {
      return 0;
    }

    uint popId = first(tree);
    remove(tree, popId);
    return popId;
  }
}
