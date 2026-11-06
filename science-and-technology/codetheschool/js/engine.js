/* Code to Class — a tiny, friendly Python-ish interpreter for Milo's walk. */
(function (root) {
  "use strict";

  const DIRECTIONS = [
    { x: 0, y: -1, name: "north" },
    { x: 1, y: 0, name: "east" },
    { x: 0, y: 1, name: "south" },
    { x: -1, y: 0, name: "west" }
  ];

  class ProgramError extends Error {
    constructor(message, line) {
      super(message);
      this.name = "ProgramError";
      this.line = line || null;
    }
  }

  class ReturnSignal {
    constructor(value) {
      this.value = value;
    }
  }
  class BreakSignal {}
  class ContinueSignal {}
  class SuccessSignal {}

  function truthy(value) {
    if (value === false || value === null || value === undefined) return false;
    if (typeof value === "number") return value !== 0 && !Number.isNaN(value);
    if (typeof value === "string") return value.length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  }

  function display(value) {
    if (value === null || value === undefined) return "None";
    if (value === true) return "True";
    if (value === false) return "False";
    if (Array.isArray(value)) return "[" + value.map(display).join(", ") + "]";
    return String(value);
  }

  /* ------------------------------------------------------------------ */
  /* The simulated school route                                          */
  /* ------------------------------------------------------------------ */

  class Field {
    constructor(level) {
      this.level = level;
      this.x = level.start.x;
      this.y = level.start.y;
      this.dir = level.start.dir;
      this.walls = new Set((level.walls || []).map(([x, y]) => x + "," + y));
      this.events = [];
      this.actions = 0;
      this.moves = 0;
      this.completed = false;
    }

    key(x, y) {
      return x + "," + y;
    }

    atGoal() {
      return this.x === this.level.goal.x && this.y === this.level.goal.y;
    }

    canMove() {
      const d = DIRECTIONS[this.dir];
      const nx = this.x + d.x;
      const ny = this.y + d.y;
      return (
        nx >= 0 && ny >= 0 &&
        nx < this.level.size.w && ny < this.level.size.h &&
        !this.walls.has(this.key(nx, ny))
      );
    }

    tick(line) {
      this.actions += 1;
      if (this.actions > 700) {
        throw new ProgramError(
          "You got dizzy after 700 actions. Check for a loop that never ends.",
          line
        );
      }
    }

    move(line) {
      this.tick(line);
      const d = DIRECTIONS[this.dir];
      const nx = this.x + d.x;
      const ny = this.y + d.y;
      const key = this.key(nx, ny);
      const outside =
        nx < 0 || ny < 0 || nx >= this.level.size.w || ny >= this.level.size.h;

      if (outside || this.walls.has(key)) {
        const reason = this.walls.has(key)
          ? "There is a fence in the way."
          : "That is the edge of the map.";
        this.events.push({
          type: "bump",
          pos: [this.x, this.y],
          dir: this.dir,
          message: "Bonk! " + reason
        });
        throw new ProgramError("You bumped into something. " + reason, line);
      }

      this.x = nx;
      this.y = ny;
      this.moves += 1;
      this.events.push({ type: "move", pos: [nx, ny], dir: this.dir });
      this.checkComplete(line);
    }

    turnLeft(line) {
      this.tick(line);
      this.dir = (this.dir + 3) % 4;
      this.events.push({ type: "turn", pos: [this.x, this.y], dir: this.dir });
    }

    turnRight(line) {
      this.tick(line);
      this.dir = (this.dir + 1) % 4;
      this.events.push({ type: "turn", pos: [this.x, this.y], dir: this.dir });
    }

    checkComplete() {
      if (this.atGoal()) {
        this.completed = true;
        this.events.push({
          type: "complete",
          pos: [this.x, this.y],
          actions: this.actions,
          moves: this.moves
        });
        throw new SuccessSignal();
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Expression tokens and parser                                       */
  /* ------------------------------------------------------------------ */

  const KEYWORDS = new Set([
    "def", "for", "in", "while", "if", "elif", "else", "return",
    "break", "continue", "pass", "and", "or", "not",
    "True", "False", "None"
  ]);

  const BINARY_PRECEDENCE = {
    "or": 1,
    "and": 2,
    "==": 3, "!=": 3, "<": 3, "<=": 3, ">": 3, ">=": 3, "in": 3,
    "+": 4, "-": 4,
    "*": 5, "/": 5, "//": 5, "%": 5,
    "**": 6
  };

  function tokenizeExpression(source, line) {
    const tokens = [];
    let i = 0;
    while (i < source.length) {
      const ch = source[i];

      if (/\s/.test(ch)) {
        i += 1;
        continue;
      }

      if (/[0-9]/.test(ch)) {
        let text = "";
        while (i < source.length && /[0-9]/.test(source[i])) text += source[i++];
        if (source[i] === "." && /[0-9]/.test(source[i + 1] || "")) {
          text += source[i++];
          while (i < source.length && /[0-9]/.test(source[i])) text += source[i++];
        }
        tokens.push({ type: "number", value: Number(text), line });
        continue;
      }

      if (/[A-Za-z_]/.test(ch)) {
        let text = "";
        while (i < source.length && /[A-Za-z0-9_]/.test(source[i])) text += source[i++];
        tokens.push({ type: "word", value: text, line });
        continue;
      }

      if (ch === '"' || ch === "'") {
        const quote = ch;
        i += 1;
        let text = "";
        let closed = false;
        while (i < source.length) {
          const c = source[i++];
          if (c === "\\") {
            const next = source[i++];
            if (next === "n") text += "\n";
            else if (next === "t") text += "\t";
            else if (next === "r") text += "\r";
            else if (next === "\\") text += "\\";
            else if (next === "'") text += "'";
            else if (next === '"') text += '"';
            else text += next === undefined ? "" : next;
          } else if (c === quote) {
            closed = true;
            break;
          } else {
            text += c;
          }
        }
        if (!closed) throw new ProgramError("That string is missing a closing quote.", line);
        tokens.push({ type: "string", value: text, line });
        continue;
      }

      const two = source.slice(i, i + 2);
      if (["==", "!=", "<=", ">=", "//", "**"].includes(two)) {
        tokens.push({ type: "op", value: two, line });
        i += 2;
        continue;
      }

      if ("+-*/%<>()[],".includes(ch)) {
        tokens.push({ type: "op", value: ch, line });
        i += 1;
        continue;
      }

      if (ch === "!") {
        throw new ProgramError("Use `not` in Python instead of `!`.", line);
      }

      throw new ProgramError("I don't understand the symbol `" + ch + "`.", line);
    }
    tokens.push({ type: "eof", value: "", line });
    return tokens;
  }

  class ExpressionParser {
    constructor(source, line) {
      this.source = source;
      this.line = line;
      this.tokens = tokenizeExpression(source, line);
      this.i = 0;
    }

    peek() {
      return this.tokens[this.i];
    }

    next() {
      return this.tokens[this.i++];
    }

    match(value) {
      if (this.peek().value === value) {
        this.i += 1;
        return true;
      }
      return false;
    }

    expect(value) {
      if (!this.match(value)) {
        throw new ProgramError(
          "Expected `" + value + "` but found `" + (this.peek().value || "end of line") + "`.",
          this.line
        );
      }
    }

    parse() {
      if (this.peek().type === "eof") {
        throw new ProgramError("This line is missing an expression.", this.line);
      }
      const expr = this.parseExpression(0);
      if (this.peek().type !== "eof") {
        throw new ProgramError(
          "Unexpected `" + this.peek().value + "` after the expression.",
          this.line
        );
      }
      return expr;
    }

    parseExpression(minPrecedence) {
      let left = this.parseUnary();

      while (true) {
        const token = this.peek();
        const precedence = BINARY_PRECEDENCE[token.value];
        if (token.type !== "word" && token.type !== "op") break;
        if (precedence === undefined || precedence < minPrecedence) break;

        this.next();
        const right = this.parseExpression(precedence + 1);
        const type = token.value === "and" || token.value === "or" ? "boolop" : "binary";
        left = { type, op: token.value, left, right, line: this.line };
      }

      return left;
    }

    parseUnary() {
      const token = this.peek();
      if (token.value === "not") {
        this.next();
        return {
          type: "unary",
          op: token.value,
          value: this.parseExpression(3),
          line: this.line
        };
      }
      if (token.value === "-" || token.value === "+") {
        this.next();
        return {
          type: "unary",
          op: token.value,
          value: this.parseUnary(),
          line: this.line
        };
      }
      return this.parsePostfix(this.parsePrimary());
    }

    parsePostfix(expression) {
      let value = expression;
      while (true) {
        if (this.peek().value === "(") {
          value = this.parseCall(value);
          continue;
        }
        if (this.peek().value === "[") {
          this.next();
          const index = this.parseExpression(0);
          this.expect("]");
          value = { type: "index", target: value, index, line: this.line };
          continue;
        }
        break;
      }
      return value;
    }

    parsePrimary() {
      const token = this.next();

      if (token.type === "number") return { type: "literal", value: token.value, line: this.line };
      if (token.type === "string") return { type: "literal", value: token.value, line: this.line };

      if (token.type === "word") {
        if (token.value === "True") return { type: "literal", value: true, line: this.line };
        if (token.value === "False") return { type: "literal", value: false, line: this.line };
        if (token.value === "None") return { type: "literal", value: null, line: this.line };
        if (["and", "or", "not", "in"].includes(token.value)) {
          throw new ProgramError("`" + token.value + "` is in the wrong place here.", this.line);
        }
        return { type: "var", name: token.value, line: this.line };
      }

      if (token.value === "(") {
        const expr = this.parseExpression(0);
        this.expect(")");
        return expr;
      }

      if (token.value === "[") {
        const items = [];
        if (!this.match("]")) {
          while (true) {
            items.push(this.parseExpression(0));
            if (this.match("]")) break;
            this.expect(",");
            if (this.match("]")) break;
          }
        }
        return { type: "list", items, line: this.line };
      }

      throw new ProgramError(
        "Expected a value but found `" + (token.value || "end of line") + "`.",
        this.line
      );
    }

    parseCall(callee) {
      this.expect("(");
      const args = [];
      if (!this.match(")")) {
        while (true) {
          args.push(this.parseExpression(0));
          if (this.match(")")) break;
          this.expect(",");
          if (this.match(")")) break;
        }
      }
      return { type: "call", callee, args, line: this.line };
    }
  }

  /* ------------------------------------------------------------------ */
  /* Line-based block parser                                            */
  /* ------------------------------------------------------------------ */

  function stripComment(source) {
    let quote = null;
    let escaped = false;
    for (let i = 0; i < source.length; i += 1) {
      const ch = source[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (quote) {
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === '"' || ch === "'") {
        quote = ch;
        continue;
      }
      if (ch === "#") return source.slice(0, i);
    }
    return source;
  }

  class Parser {
    constructor(source) {
      const rawLines = String(source).replace(/\r\n?/g, "\n").split("\n");
      this.lines = [];
      rawLines.forEach((raw, index) => {
        const expanded = raw.replace(/\t/g, "    ");
        const withoutComment = stripComment(expanded).replace(/\s+$/, "");
        if (!withoutComment.trim()) return;
        const leading = withoutComment.match(/^ */)[0].length;
        this.lines.push({
          indent: leading,
          code: withoutComment.slice(leading),
          line: index + 1
        });
      });
      this.i = 0;
    }

    parse() {
      if (this.lines.length === 0) return [];
      if (this.lines[0].indent !== 0) {
        throw new ProgramError("The first line should not be indented.", this.lines[0].line);
      }
      const block = this.parseBlock(0);
      if (this.i < this.lines.length) {
        throw new ProgramError("Unexpected indentation.", this.lines[this.i].line);
      }
      return block;
    }

    parseBlock(indent) {
      const statements = [];
      while (this.i < this.lines.length) {
        const line = this.lines[this.i];
        if (line.indent < indent) break;
        if (line.indent > indent) {
          throw new ProgramError("Unexpected indentation.", line.line);
        }
        statements.push(this.parseStatement());
      }
      return statements;
    }

    parseRequiredBlock(parentIndent, headerLine) {
      if (this.i >= this.lines.length || this.lines[this.i].indent <= parentIndent) {
        throw new ProgramError("Expected an indented block after this line.", headerLine);
      }
      return this.parseBlock(this.lines[this.i].indent);
    }

    parseStatement() {
      const line = this.lines[this.i];
      const code = line.code;
      const lineNo = line.line;

      const compound = code.match(/^(if|elif|else|for|while|def)\b/);
      if (compound && !code.trimEnd().endsWith(":")) {
        throw new ProgramError("Expected `:` at the end of this line.", lineNo);
      }

      let match = code.match(/^def\s+([A-Za-z_]\w*)\s*\((.*)\)\s*:$/);
      if (match) {
        this.i += 1;
        const name = match[1];
        const paramText = match[2].trim();
        const params = paramText ? paramText.split(",").map((p) => p.trim()) : [];
        params.forEach((param) => {
          if (!/^[A-Za-z_]\w*$/.test(param)) {
            throw new ProgramError("Invalid parameter name `" + param + "`.", lineNo);
          }
        });
        if (new Set(params).size !== params.length) {
          throw new ProgramError("A function cannot repeat a parameter name.", lineNo);
        }
        const body = this.parseRequiredBlock(line.indent, lineNo);
        return { type: "def", name, params, body, line: lineNo };
      }

      match = code.match(/^for\s+([A-Za-z_]\w*)\s+in\s+(.+)\s*:$/);
      if (match) {
        this.i += 1;
        const variable = match[1];
        const iterable = new ExpressionParser(match[2], lineNo).parse();
        const body = this.parseRequiredBlock(line.indent, lineNo);
        return { type: "for", variable, iterable, body, line: lineNo };
      }

      match = code.match(/^while\s+(.+)\s*:$/);
      if (match) {
        this.i += 1;
        const condition = new ExpressionParser(match[1], lineNo).parse();
        const body = this.parseRequiredBlock(line.indent, lineNo);
        return { type: "while", condition, body, line: lineNo };
      }

      match = code.match(/^if\s+(.+)\s*:$/);
      if (match) {
        this.i += 1;
        return this.parseIfChain(line, match[1]);
      }

      if (/^elif\b/.test(code)) {
        throw new ProgramError("`elif` must follow an `if` block.", lineNo);
      }
      if (/^else\b/.test(code)) {
        throw new ProgramError("`else` must follow an `if` block.", lineNo);
      }

      if (/^return\b/.test(code)) {
        this.i += 1;
        const expression = code.replace(/^return\b\s*/, "");
        return {
          type: "return",
          value: expression ? new ExpressionParser(expression, lineNo).parse() : null,
          line: lineNo
        };
      }

      if (code === "break") {
        this.i += 1;
        return { type: "break", line: lineNo };
      }
      if (code === "continue") {
        this.i += 1;
        return { type: "continue", line: lineNo };
      }
      if (code === "pass") {
        this.i += 1;
        return { type: "pass", line: lineNo };
      }

      match = code.match(/^([A-Za-z_]\w*)\s*(=|\+=|-=|\*=|\/=)\s*(?!=)(.+)$/);
      if (match) {
        this.i += 1;
        return {
          type: "assign",
          name: match[1],
          operator: match[2],
          value: new ExpressionParser(match[3], lineNo).parse(),
          line: lineNo
        };
      }

      this.i += 1;
      return {
        type: "expression",
        expression: new ExpressionParser(code, lineNo).parse(),
        line: lineNo
      };
    }

    parseIfChain(firstLine, firstCondition) {
      const branches = [];
      let condition = new ExpressionParser(firstCondition, firstLine.line).parse();
      let body = this.parseRequiredBlock(firstLine.indent, firstLine.line);
      branches.push({ condition, body });

      while (this.i < this.lines.length) {
        const next = this.lines[this.i];
        if (next.indent !== firstLine.indent) break;

        const elif = next.code.match(/^elif\s+(.+)\s*:$/);
        if (elif) {
          this.i += 1;
          condition = new ExpressionParser(elif[1], next.line).parse();
          body = this.parseRequiredBlock(next.indent, next.line);
          branches.push({ condition, body });
          continue;
        }

        if (/^else\s*:$/.test(next.code)) {
          this.i += 1;
          body = this.parseRequiredBlock(next.indent, next.line);
          branches.push({ condition: null, body });
          break;
        }
        break;
      }

      return { type: "if", branches, line: firstLine.line };
    }
  }

  /* ------------------------------------------------------------------ */
  /* Interpreter                                                        */
  /* ------------------------------------------------------------------ */

  class Environment {
    constructor(parent) {
      this.parent = parent || null;
      this.vars = new Map();
    }

    has(name) {
      if (this.vars.has(name)) return true;
      return this.parent ? this.parent.has(name) : false;
    }

    get(name) {
      if (this.vars.has(name)) return this.vars.get(name);
      if (this.parent) return this.parent.get(name);
      throw new ProgramError("I don't know the name `" + name + "` yet.", null);
    }

    set(name, value) {
      this.vars.set(name, value);
    }
  }

  class UserFunction {
    constructor(name, params, body, closure) {
      this.name = name;
      this.params = params;
      this.body = body;
      this.closure = closure;
    }
  }

  const GAME_COMMANDS = new Set([
    "move_forward", "turn_left", "turn_right",
    "at_school", "can_move", "say", "print"
  ]);

  const LANGUAGE_FUNCTIONS = new Set([
    "range", "len", "str", "int", "bool", "abs", "min", "max", "sum"
  ]);

  class Interpreter {
    constructor(field) {
      this.field = field;
      this.steps = 0;
      this.callDepth = 0;
      this.functionDepth = 0;
      this.loopDepth = 0;
    }

    tick(line) {
      this.steps += 1;
      if (this.steps > 20000) {
        throw new ProgramError(
          "Your program ran for 20,000 steps. Look for a loop that never ends.",
          line
        );
      }
    }

    run(statements) {
      const global = new Environment();
      this.execBlock(statements, global);
    }

    execBlock(statements, env) {
      for (const statement of statements) {
        this.execStatement(statement, env);
      }
    }

    execStatement(statement, env) {
      this.tick(statement.line);

      if (statement.type === "expression") {
        this.eval(statement.expression, env);
        return;
      }

      if (statement.type === "assign") {
        let value = this.eval(statement.value, env);
        if (statement.operator !== "=") {
          let current;
          try {
            current = env.get(statement.name);
          } catch (error) {
            throw new ProgramError(
              "`" + statement.name + "` needs a value before you can use `" + statement.operator + "`.",
              statement.line
            );
          }
          value = this.applyBinary(
            statement.operator[0],
            current,
            value,
            statement.line
          );
        }
        env.set(statement.name, value);
        return;
      }

      if (statement.type === "def") {
        env.set(
          statement.name,
          new UserFunction(statement.name, statement.params, statement.body, env)
        );
        return;
      }

      if (statement.type === "if") {
        for (const branch of statement.branches) {
          if (branch.condition === null || truthy(this.eval(branch.condition, env))) {
            this.execBlock(branch.body, env);
            return;
          }
        }
        return;
      }

      if (statement.type === "for") {
        const iterable = this.eval(statement.iterable, env);
        let items;
        if (Array.isArray(iterable)) {
          items = iterable;
        } else if (typeof iterable === "string") {
          items = Array.from(iterable);
        } else {
          throw new ProgramError(
            "A for loop needs a list or range() to walk through.",
            statement.line
          );
        }
        this.loopDepth += 1;
        try {
          for (const item of items) {
            this.tick(statement.line);
            env.set(statement.variable, item);
            try {
              this.execBlock(statement.body, env);
            } catch (signal) {
              if (signal instanceof BreakSignal) break;
              if (signal instanceof ContinueSignal) continue;
              throw signal;
            }
          }
        } finally {
          this.loopDepth -= 1;
        }
        return;
      }

      if (statement.type === "while") {
        this.loopDepth += 1;
        try {
          while (truthy(this.eval(statement.condition, env))) {
            this.tick(statement.line);
            try {
              this.execBlock(statement.body, env);
            } catch (signal) {
              if (signal instanceof BreakSignal) break;
              if (signal instanceof ContinueSignal) continue;
              throw signal;
            }
          }
        } finally {
          this.loopDepth -= 1;
        }
        return;
      }

      if (statement.type === "return") {
        if (this.functionDepth === 0) {
          throw new ProgramError("`return` only works inside a function.", statement.line);
        }
        const value = statement.value === null ? null : this.eval(statement.value, env);
        throw new ReturnSignal(value);
      }

      if (statement.type === "break") {
        if (this.loopDepth === 0) {
          throw new ProgramError("`break` only works inside a loop.", statement.line);
        }
        throw new BreakSignal();
      }

      if (statement.type === "continue") {
        if (this.loopDepth === 0) {
          throw new ProgramError("`continue` only works inside a loop.", statement.line);
        }
        throw new ContinueSignal();
      }

      if (statement.type === "pass") return;

      throw new ProgramError("I don't know how to run this line.", statement.line);
    }

    eval(node, env) {
      if (node.type === "literal") return node.value;

      if (node.type === "var") {
        try {
          return env.get(node.name);
        } catch (error) {
          if (GAME_COMMANDS.has(node.name) || LANGUAGE_FUNCTIONS.has(node.name)) {
            throw new ProgramError(
              "`" + node.name + "` is a command. Add parentheses to call it, like `" + node.name + "()`.",
              node.line
            );
          }
          throw new ProgramError("I don't know the name `" + node.name + "` yet.", node.line);
        }
      }

      if (node.type === "list") {
        return node.items.map((item) => this.eval(item, env));
      }

      if (node.type === "index") {
        const target = this.eval(node.target, env);
        const index = this.eval(node.index, env);
        if (!Number.isInteger(index)) {
          throw new ProgramError("A list index must be a whole number.", node.line);
        }
        if (Array.isArray(target)) {
          const actual = index < 0 ? target.length + index : index;
          if (actual < 0 || actual >= target.length) {
            throw new ProgramError("That index is outside the list.", node.line);
          }
          return target[actual];
        }
        if (typeof target === "string") {
          const actual = index < 0 ? target.length + index : index;
          if (actual < 0 || actual >= target.length) {
            throw new ProgramError("That index is outside the string.", node.line);
          }
          return target[actual];
        }
        throw new ProgramError("Only lists and strings can be indexed.", node.line);
      }

      if (node.type === "unary") {
        const value = this.eval(node.value, env);
        if (node.op === "not") return !truthy(value);
        if (typeof value !== "number") {
          throw new ProgramError("`" + node.op + "` works on numbers.", node.line);
        }
        return node.op === "-" ? -value : value;
      }

      if (node.type === "boolop") {
        const left = this.eval(node.left, env);
        if (node.op === "and") return truthy(left) ? this.eval(node.right, env) : left;
        return truthy(left) ? left : this.eval(node.right, env);
      }

      if (node.type === "binary") {
        const left = this.eval(node.left, env);
        const right = this.eval(node.right, env);
        return this.applyBinary(node.op, left, right, node.line);
      }

      if (node.type === "call") {
        return this.evalCall(node, env);
      }

      throw new ProgramError("I don't know how to evaluate this expression.", node.line);
    }

    applyBinary(op, left, right, line) {
      if (op === "==") return left === right;
      if (op === "!=") return left !== right;

      if (op === "in") {
        if (Array.isArray(right)) return right.includes(left);
        if (typeof right === "string") return right.includes(String(left));
        throw new ProgramError("`in` needs a list or string on the right.", line);
      }

      if (op === "+") {
        if (typeof left === "number" && typeof right === "number") return left + right;
        if (typeof left === "string" && typeof right === "string") return left + right;
        throw new ProgramError("`+` needs two numbers or two strings.", line);
      }

      if (["<", "<=", ">", ">="].includes(op)) {
        if (
          (typeof left === "number" && typeof right === "number") ||
          (typeof left === "string" && typeof right === "string")
        ) {
          if (op === "<") return left < right;
          if (op === "<=") return left <= right;
          if (op === ">") return left > right;
          return left >= right;
        }
        throw new ProgramError("Those values can't be compared with `" + op + "`.", line);
      }

      if (typeof left !== "number" || typeof right !== "number") {
        throw new ProgramError("`" + op + "` needs numbers on both sides.", line);
      }

      if (op === "-") return left - right;
      if (op === "*") return left * right;
      if (op === "/") {
        if (right === 0) throw new ProgramError("You can't divide by zero.", line);
        return left / right;
      }
      if (op === "//") {
        if (right === 0) throw new ProgramError("You can't divide by zero.", line);
        return Math.floor(left / right);
      }
      if (op === "%") {
        if (right === 0) throw new ProgramError("You can't divide by zero.", line);
        return ((left % right) + right) % right;
      }
      if (op === "**") return left ** right;
      throw new ProgramError("I don't know the operator `" + op + "`.", line);
    }

    evalCall(node, env) {
      if (node.callee.type !== "var") {
        throw new ProgramError("Only named functions can be called.", node.line);
      }
      const name = node.callee.name;
      const args = node.args.map((arg) => this.eval(arg, env));

      if (env.has(name)) {
        const value = env.get(name);
        if (value instanceof UserFunction) {
          return this.callUserFunction(value, args, node.line);
        }
        throw new ProgramError("`" + name + "` is not a function.", node.line);
      }

      if (GAME_COMMANDS.has(name) || LANGUAGE_FUNCTIONS.has(name)) {
        return this.callBuiltin(name, args, node.line);
      }

      throw new ProgramError(
        "I don't know a command called `" + name + "`. Check the pocket guide.",
        node.line
      );
    }

    callUserFunction(fn, args, line) {
      if (args.length !== fn.params.length) {
        throw new ProgramError(
          "`" + fn.name + "()` takes " + fn.params.length + " argument" +
            (fn.params.length === 1 ? "" : "s") + ", but got " + args.length + ".",
          line
        );
      }
      if (this.callDepth >= 50) {
        throw new ProgramError("That function called itself too many times.", line);
      }

      const local = new Environment(fn.closure);
      fn.params.forEach((param, index) => local.set(param, args[index]));
      const outerLoopDepth = this.loopDepth;
      this.loopDepth = 0;
      this.callDepth += 1;
      this.functionDepth += 1;
      try {
        this.execBlock(fn.body, local);
      } catch (signal) {
        if (signal instanceof ReturnSignal) return signal.value;
        throw signal;
      } finally {
        this.callDepth -= 1;
        this.functionDepth -= 1;
        this.loopDepth = outerLoopDepth;
      }
      return null;
    }

    expectArgs(name, args, count, line) {
      if (args.length !== count) {
        throw new ProgramError(
          "`" + name + "()` takes " + count + " argument" + (count === 1 ? "" : "s") +
            ", but got " + args.length + ".",
          line
        );
      }
    }

    callBuiltin(name, args, line) {
      if (name === "move_forward") {
        this.expectArgs(name, args, 0, line);
        this.field.move(line);
        return null;
      }
      if (name === "turn_left") {
        this.expectArgs(name, args, 0, line);
        this.field.turnLeft(line);
        return null;
      }
      if (name === "turn_right") {
        this.expectArgs(name, args, 0, line);
        this.field.turnRight(line);
        return null;
      }
      if (name === "at_school") {
        this.expectArgs(name, args, 0, line);
        return this.field.atGoal();
      }
      if (name === "can_move") {
        this.expectArgs(name, args, 0, line);
        return this.field.canMove();
      }
      if (name === "say") {
        this.expectArgs(name, args, 1, line);
        this.field.events.push({ type: "say", text: display(args[0]) });
        return null;
      }
      if (name === "print") {
        this.field.events.push({
          type: "print",
          text: args.length ? args.map(display).join(" ") : ""
        });
        return null;
      }
      if (name === "range") {
        if (args.length < 1 || args.length > 3) {
          throw new ProgramError("`range()` takes 1 to 3 numbers.", line);
        }
        args.forEach((arg) => {
          if (!Number.isInteger(arg)) {
            throw new ProgramError("`range()` needs whole numbers.", line);
          }
        });
        let start = 0;
        let stop = args[0];
        let step = 1;
        if (args.length >= 2) {
          start = args[0];
          stop = args[1];
        }
        if (args.length === 3) step = args[2];
        if (step === 0) throw new ProgramError("`range()` cannot step by zero.", line);
        const items = [];
        if (step > 0) {
          for (let value = start; value < stop; value += step) {
            items.push(value);
            if (items.length > 10000) break;
          }
        } else {
          for (let value = start; value > stop; value += step) {
            items.push(value);
            if (items.length > 10000) break;
          }
        }
        if (items.length > 10000) {
          throw new ProgramError("That range is too big for your overwhelmed brain.", line);
        }
        return items;
      }
      if (name === "len") {
        this.expectArgs(name, args, 1, line);
        if (Array.isArray(args[0]) || typeof args[0] === "string") return args[0].length;
        throw new ProgramError("`len()` works on lists and strings.", line);
      }
      if (name === "str") {
        this.expectArgs(name, args, 1, line);
        return display(args[0]);
      }
      if (name === "int") {
        this.expectArgs(name, args, 1, line);
        const number = Number(args[0]);
        if (Number.isNaN(number)) throw new ProgramError("That cannot become a whole number.", line);
        return Math.trunc(number);
      }
      if (name === "bool") {
        this.expectArgs(name, args, 1, line);
        return truthy(args[0]);
      }
      if (name === "abs") {
        this.expectArgs(name, args, 1, line);
        if (typeof args[0] !== "number") throw new ProgramError("`abs()` needs a number.", line);
        return Math.abs(args[0]);
      }
      if (name === "min" || name === "max") {
        if (args.length === 0) throw new ProgramError("`" + name + "()` needs at least one number.", line);
        const values = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
        if (values.some((value) => typeof value !== "number")) {
          throw new ProgramError("`" + name + "()` works on numbers.", line);
        }
        return name === "min" ? Math.min(...values) : Math.max(...values);
      }
      if (name === "sum") {
        if (args.length !== 1 || !Array.isArray(args[0])) {
          throw new ProgramError("`sum()` needs one list of numbers.", line);
        }
        if (args[0].some((value) => typeof value !== "number")) {
          throw new ProgramError("`sum()` needs a list of numbers.", line);
        }
        return args[0].reduce((total, value) => total + value, 0);
      }

      throw new ProgramError("I don't know the command `" + name + "`.", line);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Public run function                                               */
  /* ------------------------------------------------------------------ */

  function run(source, level) {
    const result = {
      completed: false,
      finished: false,
      events: [],
      error: null,
      actions: 0,
      moves: 0
    };

    let statements;
    try {
      statements = new Parser(source).parse();
    } catch (error) {
      if (error instanceof ProgramError) {
        result.error = { message: error.message, line: error.line, stage: "parse" };
        result.finished = true;
        return result;
      }
      throw error;
    }

    const field = new Field(level);
    const interpreter = new Interpreter(field);

    try {
      interpreter.run(statements);
      result.finished = true;
    } catch (error) {
      if (error instanceof SuccessSignal) {
        result.completed = true;
        result.finished = true;
      } else if (error instanceof ProgramError) {
        result.error = { message: error.message, line: error.line, stage: "runtime" };
        field.events.push({
          type: "error",
          message: error.message,
          line: error.line
        });
        result.finished = true;
      } else if (error instanceof ReturnSignal) {
        result.error = {
          message: "`return` only works inside a function.",
          line: null,
          stage: "runtime"
        };
        field.events.push({ type: "error", message: result.error.message, line: null });
        result.finished = true;
      } else {
        // Keep an unexpected engine failure from breaking the UI.
        console.error(error);
        result.error = {
          message: "You hit an unexpected snag. Try simplifying your code.",
          line: null,
          stage: "runtime"
        };
        field.events.push({ type: "error", message: result.error.message, line: null });
        result.finished = true;
      }
    }

    result.events = field.events;
    result.actions = field.actions;
    result.moves = field.moves;
    return result;
  }

  const Engine = {
    run,
    Parser,
    Field,
    ProgramError,
    DIRECTIONS,
    KEYWORDS,
    GAME_COMMANDS,
    LANGUAGE_FUNCTIONS
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = Engine;
  } else {
    root.Engine = Engine;
  }
})(typeof window !== "undefined" ? window : globalThis);
