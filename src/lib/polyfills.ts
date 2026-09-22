/**
 * 低版本 Android WebView 的运行时 polyfill。
 *
 * 为什么要手写而不用 core-js：core-js 需要打包器参与按需注入，而我们需要它
 * **在任何 bundle 之前**执行。这里用一个内联 <script> 注入，见 app/layout.tsx。
 *
 * 关键约束：本文件会被原样内联进 HTML，必须使用 ES5 语法 ——
 * 箭头函数、let/const、模板字符串、可选链等，旧引擎连解析都做不到，
 * 那样 polyfill 本身就失效了。
 *
 * 覆盖范围（按引入版本）：
 *   globalThis            Chrome 71
 *   Object.fromEntries    Chrome 73
 *   Promise.allSettled    Chrome 76
 *   Promise.any           Chrome 85
 *   Array.prototype.at    Chrome 92
 *   Array.flat/flatMap    Chrome 69
 *   String.replaceAll     Chrome 85
 *   Object.hasOwn         Chrome 93
 *   Array.findLast*       Chrome 97
 *
 * 刻意不 polyfill：crypto.subtle（Chrome 37，但只在安全上下文可用，无法 polyfill）、
 * URLSearchParams（Chrome 49，属于硬下限）。
 */

export const POLYFILL_SCRIPT = `
(function () {
  'use strict';

  /* ---------------------------------------------------------------- */
  /* globalThis (Chrome 71)                                            */
  /* ---------------------------------------------------------------- */
  if (typeof globalThis === 'undefined') {
    // 注意：不要用 Function('return this')()，部分旧 WebView 的 CSP 会拦它
    var getGlobal = function () {
      if (typeof self !== 'undefined') return self;
      if (typeof window !== 'undefined') return window;
      if (typeof global !== 'undefined') return global;
      return {};
    };
    var g = getGlobal();
    try {
      Object.defineProperty(g, 'globalThis', {
        configurable: true,
        writable: true,
        value: g
      });
    } catch (e) {
      g.globalThis = g;
    }
  }

  var G = globalThis;

  /* ---------------------------------------------------------------- */
  /* Object.fromEntries (Chrome 73)                                    */
  /* ---------------------------------------------------------------- */
  if (typeof Object.fromEntries !== 'function') {
    Object.defineProperty(Object, 'fromEntries', {
      configurable: true,
      writable: true,
      value: function fromEntries(iterable) {
        // 与规范一致：不可迭代（含数字、普通对象）必须抛 TypeError
        var iter = iterable == null ? null : iterable[Symbol.iterator];
        if (typeof iter !== 'function') {
          throw new TypeError('Object.fromEntries requires an iterable');
        }
        var obj = {};
        var it = iter.call(iterable);
        var step;
        while (!(step = it.next()).done) {
          var pair = step.value;
          // 每一项必须是对象，否则抛 TypeError（与原生一致）
          if (pair === null || (typeof pair !== 'object' && typeof pair !== 'function')) {
            throw new TypeError('iterator value ' + pair + ' is not an entry object');
          }
          obj[pair[0]] = pair[1];
        }
        return obj;
      }
    });
  }

  /* ---------------------------------------------------------------- */
  /* Object.hasOwn (Chrome 93)                                         */
  /* ---------------------------------------------------------------- */
  if (typeof Object.hasOwn !== 'function') {
    Object.defineProperty(Object, 'hasOwn', {
      configurable: true,
      writable: true,
      value: function hasOwn(obj, prop) {
        if (obj == null) throw new TypeError('Cannot convert undefined or null to object');
        return Object.prototype.hasOwnProperty.call(Object(obj), prop);
      }
    });
  }

  /* ---------------------------------------------------------------- */
  /* Array.prototype.at (Chrome 92)                                    */
  /* ---------------------------------------------------------------- */
  if (typeof Array.prototype.at !== 'function') {
    var atImpl = function at(index) {
      var len = this.length >>> 0;
      var k = Math.trunc ? Math.trunc(index) : (index < 0 ? Math.ceil(index) : Math.floor(index));
      if (k < 0) k += len;
      if (k < 0 || k >= len) return undefined;
      return this[k];
    };
    Object.defineProperty(Array.prototype, 'at', {
      configurable: true, writable: true, value: atImpl
    });
    if (typeof String !== 'undefined') {
      Object.defineProperty(String.prototype, 'at', {
        configurable: true, writable: true,
        value: function (index) {
          var s = String(this);
          var len = s.length;
          var k = index < 0 ? Math.ceil(index) : Math.floor(index);
          if (k < 0) k += len;
          if (k < 0 || k >= len) return undefined;
          return s.charAt(k);
        }
      });
    }
  }

  /* ---------------------------------------------------------------- */
  /* Array.prototype.flat / flatMap (Chrome 69)                        */
  /* ---------------------------------------------------------------- */
  var flattenInto = function (target, source, depth) {
    for (var i = 0; i < source.length; i++) {
      var v = source[i];
      if (Array.isArray(v) && depth > 0) {
        flattenInto(target, v, depth - 1);
      } else {
        target.push(v);
      }
    }
    return target;
  };

  if (typeof Array.prototype.flat !== 'function') {
    Object.defineProperty(Array.prototype, 'flat', {
      configurable: true, writable: true,
      value: function flat(depth) {
        var d = depth === undefined ? 1 : Number(depth);
        if (isNaN(d)) d = 0;
        d = d < 0 ? 0 : Math.floor(d);
        return flattenInto([], this, d);
      }
    });
  }

  if (typeof Array.prototype.flatMap !== 'function') {
    Object.defineProperty(Array.prototype, 'flatMap', {
      configurable: true, writable: true,
      value: function flatMap(callback, thisArg) {
        if (typeof callback !== 'function') {
          throw new TypeError(callback + ' is not a function');
        }
        return flattenInto([], Array.prototype.map.call(this, callback, thisArg), 1);
      }
    });
  }

  /* ---------------------------------------------------------------- */
  /* Array.prototype.findLast / findLastIndex (Chrome 97)              */
  /* ---------------------------------------------------------------- */
  if (typeof Array.prototype.findLast !== 'function') {
    Object.defineProperty(Array.prototype, 'findLast', {
      configurable: true, writable: true,
      value: function findLast(predicate, thisArg) {
        if (typeof predicate !== 'function') throw new TypeError(predicate + ' is not a function');
        for (var i = this.length - 1; i >= 0; i--) {
          if (predicate.call(thisArg, this[i], i, this)) return this[i];
        }
        return undefined;
      }
    });
  }
  if (typeof Array.prototype.findLastIndex !== 'function') {
    Object.defineProperty(Array.prototype, 'findLastIndex', {
      configurable: true, writable: true,
      value: function findLastIndex(predicate, thisArg) {
        if (typeof predicate !== 'function') throw new TypeError(predicate + ' is not a function');
        for (var i = this.length - 1; i >= 0; i--) {
          if (predicate.call(thisArg, this[i], i, this)) return i;
        }
        return -1;
      }
    });
  }

  /* ---------------------------------------------------------------- */
  /* String.prototype.replaceAll (Chrome 85)                           */
  /* ---------------------------------------------------------------- */
  if (typeof String.prototype.replaceAll !== 'function') {
    Object.defineProperty(String.prototype, 'replaceAll', {
      configurable: true, writable: true,
      value: function replaceAll(search, replacement) {
        if (search instanceof RegExp) {
          if (!search.global) {
            throw new TypeError('replaceAll must be called with a global RegExp');
          }
          return this.replace(search, replacement);
        }
        // 按字面量处理，避免把用户输入当成正则元字符。
        // 用 replace + 转义正则元字符，而不是 split/join：
        // 规范要求对替换串做 GetSubstitution（美元符号后接 & 等模式），
        // String.replace 在 search 为字符串时同样会做这一步，行为与原生一致。
        var str = String(this);
        var needle = String(search);
        // 注意：本文件整体是一个模板字符串，注释里不能出现反引号，
        // 正则里的美元花括号也必须转义，否则会被当成模板插值。
        var escaped = needle.replace(/[.*+?^\${}()|[\]\\]/g, '\\$&');
        if (needle === '') {
          // 空串：在首尾与每个字符之间插入
          return str.replace(new RegExp('(?:)', 'g'), replacement);
        }
        return str.replace(new RegExp(escaped, 'g'), replacement);
      }
    });
  }

  /* ---------------------------------------------------------------- */
  /* Promise.allSettled / Promise.any (Chrome 76 / 85)                 */
  /* ---------------------------------------------------------------- */
  if (typeof Promise !== 'undefined') {
    if (typeof Promise.allSettled !== 'function') {
      Object.defineProperty(Promise, 'allSettled', {
        configurable: true, writable: true,
        value: function allSettled(iterable) {
          var self = this;
          return new self(function (resolve) {
            var items = Array.prototype.slice.call(iterable);
            var results = new Array(items.length);
            var remaining = items.length;
            if (remaining === 0) return resolve([]);
            var settle = function (i, status, value) {
              results[i] = status === 'fulfilled'
                ? { status: 'fulfilled', value: value }
                : { status: 'rejected', reason: value };
              if (--remaining === 0) resolve(results);
            };
            items.forEach(function (item, i) {
              self.resolve(item).then(
                function (v) { settle(i, 'fulfilled', v); },
                function (e) { settle(i, 'rejected', e); }
              );
            });
          });
        }
      });
    }

    if (typeof Promise.any !== 'function') {
      Object.defineProperty(Promise, 'any', {
        configurable: true, writable: true,
        value: function any(iterable) {
          var self = this;
          return new self(function (resolve, reject) {
            var items = Array.prototype.slice.call(iterable);
            var errors = new Array(items.length);
            var remaining = items.length;
            if (remaining === 0) {
              var e0 = new Error('All promises were rejected');
              e0.name = 'AggregateError';
              e0.errors = [];
              return reject(e0);
            }
            items.forEach(function (item, i) {
              self.resolve(item).then(resolve, function (err) {
                errors[i] = err;
                if (--remaining === 0) {
                  var e = new Error('All promises were rejected');
                  e.name = 'AggregateError';
                  e.errors = errors;
                  reject(e);
                }
              });
            });
          });
        }
      });
    }
  }

  /* ---------------------------------------------------------------- */
  /* 环境能力标记：供组件判断哪些入口可用                              */
  /* ---------------------------------------------------------------- */
  var caps = {
    webCrypto: !!(G.crypto && G.crypto.subtle && G.crypto.subtle.importKey),
    displayCapture: !!(G.navigator && G.navigator.mediaDevices && G.navigator.mediaDevices.getDisplayMedia),
    clipboardRead: !!(G.navigator && G.navigator.clipboard && G.navigator.clipboard.read),
    clipboardWrite: !!(G.navigator && G.navigator.clipboard && G.navigator.clipboard.writeText),
    imageDecode: typeof Image !== 'undefined' && typeof Image.prototype.decode === 'function',
    secureContext: !!G.isSecureContext
  };
  try {
    G.__mvCaps = caps;
  } catch (e) {
    /* 忽略：只影响降级提示 */
  }
})();
`;
