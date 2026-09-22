/**
 * 低版本 Android WebView 的 CSS 降级插件（CommonJS）。
 *
 * 为什么是 .cjs：Next.js 通过 postcss-load-config 以 require() 加载
 * postcss.config.mjs 里以**字符串键**声明的插件，ESM 文件无法被 require。
 *
 * Tailwind CSS v4 生成的样式大量使用 Chromium 99+ 才支持的特性。旧 WebView
 * （Android 5–9 的原生 WebView、未升级的 Android System WebView）会遇到：
 *
 *   @layer        Chromium 99   —— 不认识的 at-rule 会让**整个块被丢弃**，页面完全没样式
 *   oklch()       Chromium 111  —— 颜色声明整条失效
 *   :where()      Chromium 88   —— 选择器非法，整条规则被丢弃
 *   :is()         Chromium 88   —— 同上
 *   dvh 单位      Chromium 108  —— 高度计算失败，全屏面板塌陷
 *   translate:    Chromium 104  —— 居中/偏移丢失
 *
 * @layer 与 oklch() 由 @csstools 的官方插件处理；本插件负责选择器与单位。
 *
 * ## 关于 :where() / :is()
 *
 * 两者只差**特异性**，匹配语义完全一致，所以可以安全地把 :where 改写为 :is。
 * 但 @csstools/postcss-is-pseudo-class 只会展开「位于选择器末尾」的 :is()，
 * 形如 `h1:is(.dark *)` 这种**参数里带后代组合器**的写法它不会动
 * （`h1:is(.dark *)` 语义上等价于 `.dark h1`）。
 *
 * 因此本插件直接做等价改写：
 *   X:where(.dark *)      ->  .dark X
 *   X:where(.group:hover *) -> .group:hover X
 *   X:where(.dark)        ->  X.dark
 *   X:where(.a, .b)       ->  X.a, X.b
 *
 * 剩下的简单形式（末尾的 :is）交给 is-pseudo-class 插件兜底。
 */

"use strict";

var postcss = require("postcss");

/**
 * 把一个 `:where(...)` / `:is(...)` 调用替换为等价的平铺选择器。
 * 返回替换后的选择器数组（因为逗号分支会展开成多条）。
 */
function expandPseudo(selector) {
  var out = [selector];
  var guard = 0;

  // 反复处理，直到没有可展开的伪类（或达到保护上限）
  while (guard++ < 50) {
    var changed = false;
    var next = [];

    for (var s = 0; s < out.length; s++) {
      var sel = out[s];
      var hit = findPseudo(sel);
      if (!hit) {
        next.push(sel);
        continue;
      }

      changed = true;
      var branches = splitTopLevel(hit.args);
      var expanded = [];
      var hasPrefix = hit.prefix.trim() !== "";

      for (var b = 0; b < branches.length; b++) {
        var branch = branches[b].trim();
        if (!branch) continue;

        // 前缀为空：`:where(X)` 等价于 `X`，无论 X 里有没有组合器。
        // 例如 `:where(.prose-memo ul>:not(:last-child))` -> `.prose-memo ul>:not(:last-child)`
        if (!hasPrefix) {
          expanded.push(branch);
          continue;
        }

        // 带空格 = 含组合器。Tailwind 的 dark 变体是 `.dark *`：
        // X:where(.dark *)  ===  .dark X   —— 把末尾的 `*` 换成前缀
        if (/\s/.test(branch) && !/^[>+~]/.test(branch)) {
          var parts = branch.split(/\s+/);
          if (parts[parts.length - 1] === "*") {
            var ancestor = parts.slice(0, -1).join(" ");
            expanded.push(ancestor + " " + hit.prefix);
            continue;
          }
          // 其它带空格的复杂形式：保守处理，保留原伪类以免改错语义
          expanded.push(hit.prefix + ":" + hit.name + "(" + branch + ")");
          continue;
        }

        // 简单形式：X:where(.dark) -> X.dark；X:where(.a,.b) -> X.a, X.b
        expanded.push(hit.prefix + branch);
      }

      // 把展开结果拼回原选择器：前缀 + 展开项 + 后缀
      for (var e = 0; e < expanded.length; e++) {
        next.push(expanded[e] + hit.after);
      }
    }

    out = next;
    if (!changed) break;
  }

  return out;
}

/** 找到选择器里第一个 :where( / :is( 调用，返回其位置与参数 */
function findPseudo(sel) {
  var idx = -1;
  var name = null;
  var w = sel.indexOf(":where(");
  var i = sel.indexOf(":is(");
  if (w !== -1 && (i === -1 || w < i)) {
    idx = w;
    name = "where";
  } else if (i !== -1) {
    idx = i;
    name = "is";
  }
  if (idx === -1) return null;

  var open = sel.indexOf("(", idx);
  var depth = 0;
  var close = -1;
  for (var k = open; k < sel.length; k++) {
    var ch = sel[k];
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) {
        close = k;
        break;
      }
    }
  }
  if (close === -1) return null;

  return {
    name: name,
    /** 伪类之前的部分（作为要附加的目标） */
    prefix: sel.slice(0, idx),
    /** 伪类之后的部分（例如 ` .child`、` > span`） */
    after: sel.slice(close + 1),
    args: sel.slice(open + 1, close),
  };
}

/** 按顶层逗号切分（忽略括号内的逗号） */
function splitTopLevel(input) {
  var parts = [];
  var depth = 0;
  var cur = "";
  for (var i = 0; i < input.length; i++) {
    var ch = input[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) parts.push(cur);
  return parts;
}

/** 按顶层空白切分（忽略括号内的空白），用于解析 `gap: <row> <col>` */
function splitTopLevelWhitespace(input) {
  var parts = [];
  var depth = 0;
  var cur = "";
  for (var i = 0; i < input.length; i++) {
    var ch = input[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (/\s/.test(ch) && depth === 0) {
      if (cur.trim()) parts.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

var DVH_RE = /(\d*\.?\d+)dvh\b/g;
var SVH_LVH_RE = /(\d*\.?\d+)(svh|lvh)\b/g;

module.exports = function androidWebviewCompat() {
  return {
    postcssPlugin: "android-webview-compat",

    Once: function (root) {
      /* ----------------------------------------------------------------
       * 1. dvh / svh / lvh -> vh 回退
       *    先插一条 vh 声明，再保留原声明：新浏览器用 dvh，旧浏览器忽略 dvh 用 vh。
       * ---------------------------------------------------------------- */
      root.walkDecls(function (decl) {
        if (!decl.value || !/dvh|svh|lvh/.test(decl.value)) return;
        var vhValue = decl.value
          .replace(DVH_RE, "$1vh")
          .replace(SVH_LVH_RE, "$1vh");
        if (vhValue !== decl.value) {
          decl.parent.insertBefore(decl, decl.clone({ value: vhValue }));
        }
      });

      /* ----------------------------------------------------------------
       * 2. translate: x y  ->  transform: translate(x, y)
       *    属性名必须改成 transform，不能沿用 translate。
       * ---------------------------------------------------------------- */
      root.walkDecls(/^translate$/, function (decl) {
        var parts = String(decl.value).trim().split(/\s+/);
        if (parts.length === 0 || parts.length > 3 || !parts[0]) return;
        var x = parts[0];
        var y = parts.length > 1 ? parts[1] : "0";
        decl.parent.insertBefore(
          decl,
          decl.clone({
            prop: "transform",
            value: "translate(" + x + ", " + y + ")",
          })
        );
        decl.remove();
      });

      /* ----------------------------------------------------------------
       * 3. :where() / :is() 展开为平铺选择器
       * ---------------------------------------------------------------- */
      root.walkRules(function (rule) {
        if (!rule.selector) return;
        if (
          rule.selector.indexOf(":where(") === -1 &&
          rule.selector.indexOf(":is(") === -1
        ) {
          return;
        }
        // 跳过 @keyframes 里的百分比选择器（不会有伪类，这里只是保险）
        if (rule.parent && rule.parent.type === "atrule" &&
            /keyframes$/i.test(rule.parent.name || "")) {
          return;
        }

        var selectors = splitTopLevel(rule.selector);
        var result = [];
        for (var i = 0; i < selectors.length; i++) {
          var expanded = expandPseudo(selectors[i].trim());
          for (var j = 0; j < expanded.length; j++) result.push(expanded[j]);
        }
        rule.selector = result.join(", ");
      });

      /* ----------------------------------------------------------------
       * 4. flex gap 回退（Chromium < 84）
       *
       * Tailwind 把 `display:flex` 和 `gap:N` 拆成两条独立规则，作用于同一个
       * 元素。旧 WebView 不认 flex 容器的 gap，间距会全部塌掉 —— 而本项目
       * 的主要目标正是 Android 5–9。
       *
       * 做法：找出所有 `.gap-*` 的值，为每个值生成两条组合选择器
       * （与 `.flex` 搭配走 margin-left，与 `.flex-col` 搭配走 margin-top），
       * 用相邻兄弟的 margin 模拟间距。整体包在 `@supports not (gap: 0px)` 里，
       * 现代浏览器完全看不到，零回归风险。
       *
       * 规模是有界的：不同 gap 值 × 2 条规则。只处理 flex —— grid 的 gap
       * 从 Chromium 57 就已支持。
       * ---------------------------------------------------------------- */
      var gapSelectors = []; // { sel: '.gap-2\\.5', rowGap, colGap }
      root.walkRules(function (rule) {
        if (!rule.selector) return;
        // 跳过 @keyframes 内的百分比选择器；但不要跳过 @layer 里的规则 ——
        // 本插件在 cascade-layers 之前/之后都可能被调用，@layer 里同样有工具类。
        if (
          rule.parent &&
          rule.parent.type === "atrule" &&
          /keyframes$/i.test(rule.parent.name || "")
        ) {
          return;
        }
        // Tailwind 输出的形式是 `.gap-2\.5:not(#\#):not(#\#)`，
        // 去掉特异性填充后应当只剩一个 gap 工具类。
        var sel = rule.selector.trim();
        var cleaned = sel.replace(/:not\(#\\#\)/g, "");
        var m = /^\.(gap-[\w.\\.-]+)$/.exec(cleaned);
        if (!m) return;
        rule.walkDecls(function (decl) {
          if (decl.prop.toLowerCase() !== "gap") return;
          var v = String(decl.value).trim();
          // calc() (Chrome 26) 与 var() (Chrome 49) 都在 Chrome 61 目标之下，
          // 因此可以原样沿用 Tailwind 的 calc(var(--spacing) * N) 表达式。
          // 只排除真正无法静态求值的关键字。
          if (!v || /inherit|initial|unset|revert/.test(v)) return;
          var parts = splitTopLevelWhitespace(v);
          gapSelectors.push({
            sel: "." + m[1],
            rowGap: parts[0],
            colGap: parts[1] || parts[0],
          });
        });
      });

      if (gapSelectors.length) {
        var supports = postcss.atRule({
          name: "supports",
          params: "not (gap: 0px)",
        });

        gapSelectors.forEach(function (g) {
          // 行方向：flex（默认 row）-> 相邻兄弟加左间距
          supports.append(
            postcss.rule({ selector: g.sel + ".flex > * + *" }).append({
              prop: "margin-left",
              value: g.colGap,
            })
          );
          // 列方向：flex-col -> 相邻兄弟加上间距
          supports.append(
            postcss.rule({ selector: g.sel + ".flex-col > * + *" }).append({
              prop: "margin-top",
              value: g.rowGap,
            })
          );
        });

        root.append(supports);
      }
    },
  };
};

module.exports.postcss = true;
