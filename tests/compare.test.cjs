const assert=require('node:assert/strict');
const {escapeValue,compareStrip}=require('../js/compare.js');
assert.equal(escapeValue(0,0,'mandelbrot',0,0,500),null);
assert.equal(escapeValue(-1,0,'mandelbrot',0,0,500),null);
assert.ok(escapeValue(2,2,'mandelbrot',0,0,500));
// Julia c=0 has the unit disk as its filled set.
for(const z of [[.5,.3],[-.8,.1],[0,0]])assert.equal(escapeValue(...z,'julia',0,0,500),null);
for(const z of [[1.2,0],[0,1.4]])assert.ok(escapeValue(...z,'julia',0,0,500));
const j={width:60,height:40,fullHeight:40,y:0,cx:-.5,cy:0,span:3.5,iterations:150,palette:[[10,20,30],[255,220,100],[10,20,30]],cycles:2,smooth:true};
// Changing only Mandelbrot zoom must not change the fixed-scale Julia image.
assert.deepEqual(compareStrip({...j,type:'julia'}),compareStrip({...j,type:'julia',span:.01}));
// Changing the shared c must change that image.
assert.notDeepEqual(compareStrip({...j,type:'julia'}),compareStrip({...j,type:'julia',cx:.32,cy:.55}));
assert.notDeepEqual(compareStrip({...j,type:'mandelbrot'}),compareStrip({...j,type:'mandelbrot',span:1}));
console.log('PASS: known orbits, Julia unit disk, fixed lower scale, shared parameter, upper zoom.');

// Coarse previews must fill even odd-sized edge blocks with opaque pixels.
const coarse=compareStrip({...j,type:'mandelbrot',width:13,height:7,fullHeight:7,stride:4});
assert.equal(coarse.length,13*7*4);for(let p=3;p<coarse.length;p+=4)assert.equal(coarse[p],255);
for(const z of [[.5,.6],[-1.8,.4],[1,1]]){const r=escapeValue(...z,'mandelbrot',0,0,500);if(r)assert.ok(Number.isFinite(r.smooth));}
console.log('PASS: coarse preview edge coverage and finite smooth colours.');
