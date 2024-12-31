var list = {
    type: {
        enter(str) {
            console.log(str);
        }
    },
    name: '123'
};
var newList = {
    type: 1
};

var method = list['type'];
list._context = newList.type;
console.log(list)
