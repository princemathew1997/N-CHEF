"""Generate a local, read-only layout audit after npm run build.

Serve dist/site and open qa-mobile.html. Uses sample data, never production APIs.
"""
from html import escape
from html.parser import HTMLParser
from pathlib import Path
import re


class Screens(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.screens = []
        self.name = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        name = attrs.get('id', '')
        if self.name is None and (name.startswith('view') or
                ('modal' in attrs.get('class', '').split() and name != 'uiAlertModal')):
            self.name, self.depth, self.parts = name, 0, []
        if self.name:
            self.parts.append(self.get_starttag_text())
            if tag not in ('input', 'img', 'br', 'hr', 'meta', 'link'):
                self.depth += 1

    def handle_endtag(self, tag):
        if self.name:
            self.parts.append(f'</{tag}>')
            self.depth -= 1
            if self.depth == 0:
                self.screens.append((self.name, ''.join(self.parts)))
                self.name = None

    def handle_data(self, data):
        if self.name:
            self.parts.append(data)

    def handle_entityref(self, name):
        self.handle_data(f'&{name};')


report = """<script>addEventListener('load',()=>{
const root=document.querySelector('main')||document.querySelector('.modal > .panel');
const visible=e=>e.getClientRects().length;
const bad=[...document.querySelectorAll('input,select,button,.dash-grid,.responsive-form-grid,.table-container,.table-scroll')]
.filter(e=>visible(e)&&!e.closest('table')&&e.getBoundingClientRect().right>innerWidth+1)
.map(e=>e.id||e.className||e.tagName);
parent.postMessage({screen:frameElement.title,overflow:root.scrollWidth>root.clientWidth+1,
vertical:root.scrollHeight>root.clientHeight,bad,
unwrapped:[...document.querySelectorAll('table')].filter(t=>visible(t)&&!t.closest('.table-container,.table-scroll')).length},'*');
});</script>"""
frames = []


def add(name, body, scripts=''):
    for width in (320, 390, 768):
        inner = '<html><head><link rel="stylesheet" href="/css/styles.css"></head><body>'
        inner += body + scripts + report + '</body></html>'
        title = f'{name} {width}'
        frames.append(f'<section><h3>{title}</h3><iframe title="{title}" '
                      f'style="width:{width}px;height:600px" srcdoc="{escape(inner, quote=True)}"></iframe></section>')


def dashboard(content):
    return '<div class="dashboard-layout active"><div class="mobile-topbar">Mobile audit</div><main class="main-content">' + content + '</main></div>'


parser = Screens()
parser.feed(Path('index.html').read_text(encoding='utf-8'))
for name, markup in parser.screens:
    markup = markup.replace('class="hidden', 'class="').replace('modal hidden', 'modal')
    markup = markup.replace('user-subdivision-content hidden', 'user-subdivision-content')
    markup = re.sub(r'(<tbody[^>]*>).*?(</tbody>)', lambda m: m[1] +
                    ('<tr>' + '<td>Mobile audit sample</td>' * 10 + '</tr>') * 12 + m[2], markup, flags=re.S)
    add(name, markup if 'class="modal' in markup[:150] else dashboard(markup))

setup = """<script>
var currentUser={id:'qa',role:'admin',assignedLocations:['all']},currentStoreView='qa',
outletsData=[{id:'qa',name:'Sample outlet with a long name'}],
masterItemsData=Array.from({length:15},(_,i)=>({id:'item'+i,name:'Sample ingredient '+i,category:'Grocery',unit:'kg',vendor:'Vendor',cuisine:'Indian',active:true})),
vendorsData=[{name:'Vendor'}],cuisinesData=[{name:'Indian'}],
committedState={outletStock:[],stockHistory:[],legacyStock:[]};window.switchToView=()=>{};
</script><script src='/js/inventory-tools.js'></script><script src='/js/inventory-ui.js'></script><script src='/js/stock-actions.js'></script>"""
for page in ('overview', 'catalog', 'receipt', 'distribute', 'adjust', 'history', 'assign', 'cuisines'):
    body = dashboard('<div id="viewMasterOrders" class="hidden"></div>')
    body += '<span id="mobileActivePage" hidden></span>'
    add('inventory:' + page, body, setup + '<script>addEventListener("load",()=>showInventoryView("inventory:' + page + '"))</script>')

listener = '<script>addEventListener("message",e=>{if(e.data.screen){const p=document.createElement("pre");p.className="audit-result";p.textContent=JSON.stringify(e.data);document.body.prepend(p)}})</script>'
Path('dist/site/qa-mobile.html').write_text('<html><body style="background:#242424;color:white">' + listener + ''.join(frames) + '</body></html>', encoding='utf-8')
print(f'Generated {len(frames)} layout cases at 320, 390 and 768 pixels.')
