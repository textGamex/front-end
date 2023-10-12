'use strict';

function tokenizer(input) {
    let current = 0;
    let tokens = [];

    while (current < input.length) {
        let char = input[current];

        if (char === '(') {
            tokens.push({
                type: 'paren',
                value: '('
            });
            current++;
            continue;
        }

        if (char === ')') {
            tokens.push({
                type: 'paren',
                value: ')'
            });
            current++;
            continue;
        }

        let WHITESPACE = /\s/;
        if (WHITESPACE.test(char)) {
            while (WHITESPACE.test(input[++current])) {
                
            }
            continue;
        }

        if (char === '"') {
            let string = '';
            // 跳过开头的双引号
            char = input[++current];
            while (input[current] !== '"') {
                string += input[current];
                current++;
            }
            // 跳过结尾的双引号
            current++;

            tokens.push({
                type: 'string',
                value: string
            });
            continue;
        }

        let NUMBERS = /[0-9]/;
        if (NUMBERS.test(char)) {
            let number = char;
            while (NUMBERS.test(input[++current])) {
                number += input[current];
            }

            tokens.push({
                type: 'number',
                value: number
            });
            continue;
        }

        // [a-z]：匹配1个小写字符, 
        // i 模式中的字符将同时匹配大小写字母
        let LETTERS = /[a-z]/i;
        if (LETTERS.test(char)) {
            let letters = char;
            while (LETTERS.test(input[++current])) {
                letters += input[current];
            }

            tokens.push({
                type: 'name',
                value: letters
            });
            continue;
        }

        throw new TypeError('I dont know what this character is: ' + char);
    }

    return tokens;
}

// console.log(tokenizer(" (add 2 ( subtract 4 2) )"));

function parser(tokens) {
    let current = 0;
    
    function walk() {
        let token = tokens[current];

        if (token.type === 'number') {
            current++;
            return {
                type: 'NumberLiteral',
                value: token.value
            };
        }

        if (token.type === 'string') {
            current++;
            return {
                type: 'StringLiteral',
                value: token.value
            };
        }

        if (token.type === 'paren' && token.value === '(') {
            // 跳过 '('

            // 获得函数名
            token = tokens[++current];
            let node = {
                type: 'CallExpression',
                name: token.value,
                params: [] 
            };

            // 获得参数
            token = tokens[++current];
            while ((token.type !== 'paren') || (token.type === 'paren' && token.value !== ')')) {
                node.params.push(walk());
                token = tokens[current];
            }

            // 跳过右括号
            current++;
            return node;
        }

        throw new TypeError(token.type);
    }

    let ast = {
        type: 'Program',
        body: []
    };

    while (current < tokens.length) {
        ast.body.push(walk());
    }

    return ast;
}

// 遍历器
function traverser(ast, visitor) {
    // 遍历 AST节点数组 对数组中的每一个元素调用 `traverseNode` 函数。
    function traverseArray(array, parent) {
      array.forEach(child => {
        traverseNode(child, parent);
      });
    }
  
    // 接受一个 `node` 和它的父节点 `parent` 作为参数
    function traverseNode(node, parent) {
      // 从 visitor 获取对应方法的对象
      let methods = visitor[node.type];
      // 通过 visitor 对应方法操作当前 node
      if (methods && methods.enter) {
        methods.enter(node, parent);
      }
  
      switch (node.type) {
        // 根节点
        case 'Program':
          traverseArray(node.body, node);
          break;
        // 函数调用
        case 'CallExpression':
          traverseArray(node.params, node);
          break;
        // 数值和字符串，不用处理
        case 'NumberLiteral':
        case 'StringLiteral':
          break;
  
        // 无法识别的字符，抛出错误提示
        default:
          throw new TypeError(node.type);
      }
      if (methods && methods.exit) {
        methods.exit(node, parent);
      }
    }
    
    // 开始遍历
    traverseNode(ast, null);
}

// 转化器，参数：AST
function transformer(ast) {
    // 创建 `newAST`，它与之前的 AST 类似，Program：新AST的根节点
    let newAst = {
      type: 'Program',
      body: [],
    };
  
    // 通过 _context 维护新旧 AST，注意 _context 是一个引用，从旧的 AST 到新的 AST。
    ast._context = newAst.body;
  
    // 通过遍历器遍历 参数：AST 和 visitor
    traverser(ast, {
      // 数值，直接原样插入新AST
      NumberLiteral: {
        enter(node, parent) {
          parent._context.push({
            type: 'NumberLiteral',
            value: node.value,
          });
        },
      },
      // 字符串，直接原样插入新AST
      StringLiteral: {
        enter(node, parent) {
          parent._context.push({
            type: 'StringLiteral',
            value: node.value,
          });
        },
      },
      // 函数调用
      CallExpression: {
        enter(node, parent) {
          // 创建不同的AST节点
          let expression = {
            type: 'CallExpression',
            callee: {
              type: 'Identifier',
              name: node.name,
            },
            arguments: [],
          };
  
          // 函数调用有子类，建立节点对应关系，供子节点使用
          node._context = expression.arguments;
  
          // 顶层函数调用算是语句，包装成特殊的AST节点
          if (parent.type !== 'CallExpression') {
  
            expression = {
              type: 'ExpressionStatement',
              expression: expression,
            };
          }
          parent._context.push(expression);
        },
      }
    });
    // 最后返回新 AST
    return newAst;
}

// 代码生成器 参数：新 AST
function codeGenerator(node) {

    switch (node.type) {
      // 遍历 body 属性中的节点，且递归调用 codeGenerator，结果按行输出
      case 'Program':
        return node.body.map(codeGenerator)
          .join('\n');
  
      // 表达式，处理表达式内容，并用分号结尾
      case 'ExpressionStatement':
        return (
          codeGenerator(node.expression) +
          ';'
        );
  
      // 函数调用，添加左右括号，参数用逗号隔开
      case 'CallExpression':
        return (
          codeGenerator(node.callee) +
          '(' +
          node.arguments.map(codeGenerator)
            .join(', ') +
          ')'
        );
  
      // 标识符，数值，原样输出
      case 'Identifier':
        return node.name;
      case 'NumberLiteral':
        return node.value;
  
      // 字符串，用双引号包起来再输出
      case 'StringLiteral':
        return '"' + node.value + '"';
  
      // 无法识别的字符，抛出错误提示
      default:
        throw new TypeError(node.type);
    }
}

let tokens = tokenizer("add(12)");
console.log(tokens);
// let ast    = parser(tokens);
// let newAst = transformer(ast);
// let output = codeGenerator(newAst);
// console.log(output);