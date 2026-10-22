import {test} from 'node:test';
import {readdirSync,readFileSync} from 'node:fs';
import {parse} from 'acorn';

test('all unbundled browser scripts parse before they are copied to deployment assets',()=>{
    for(const file of readdirSync('js').filter(file=>file.endsWith('.js'))){
        try{parse(readFileSync('js/'+file,'utf8'),{ecmaVersion:'latest',sourceType:'script'});}
        catch(error){throw new Error(file+': '+error.message);}
    }
});
