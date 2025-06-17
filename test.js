const Database = require('./index.js');
const assert = require('assert');
const fs = require('fs');

console.log('🧪 FastDB Test Başlıyor...\n');

const testFile = 'test-fastdb.bin';

if (fs.existsSync(testFile)) {
    fs.unlinkSync(testFile);
}

const db = new Database(testFile);

console.log('✅ Temel İşlemler Testi');
db.set('test', 'değer');
assert.strictEqual(db.get('test'), 'değer');
assert.strictEqual(db.has('test'), true);
assert.strictEqual(db.has('yok'), false);
console.log('   ✓ set/get/has çalışıyor');

console.log('✅ Dot Notation Testi');
db.set('kullanici.isim', 'Ahmet');
db.set('kullanici.yas', '25');
db.set('kullanici.profil.avatar', 'avatar.jpg');
assert.strictEqual(db.get('kullanici.isim'), 'Ahmet');
assert.strictEqual(db.get('kullanici.yas'), '25');
assert.strictEqual(db.get('kullanici.profil.avatar'), 'avatar.jpg');
console.log('   ✓ Nested veri erişimi çalışıyor');

console.log('✅ Array İşlemleri Testi');
db.push('favoriler', 'JavaScript');
db.push('favoriler', 'Node.js');
db.push('favoriler', 'React');
const favoriler = JSON.parse(db.get('favoriler'));
assert.strictEqual(favoriler.length, 3);
assert.strictEqual(favoriler[0], 'JavaScript');

const removed = db.pull('favoriler', 'Node.js');
const yeniFavoriler = JSON.parse(db.get('favoriler'));
assert.strictEqual(removed, 1);
assert.strictEqual(yeniFavoriler.length, 2);
console.log('   ✓ Array push/pull çalışıyor');

console.log('✅ Matematik İşlemleri Testi');
db.set('puan', '100');
db.add('puan', 50);
assert.strictEqual(parseFloat(db.get('puan')), 150);

db.subtract('puan', 25);
assert.strictEqual(parseFloat(db.get('puan')), 125);

db.multiply('puan', 2);
assert.strictEqual(parseFloat(db.get('puan')), 250);

db.divide('puan', 5);
assert.strictEqual(parseFloat(db.get('puan')), 50);
console.log('   ✓ Matematik operasyonları çalışıyor');

console.log('✅ Yedekleme Testi');
db.set('yedek.test', 'yedek-değer');
db.backup('test-backup.json');
assert.strictEqual(fs.existsSync('test-backup.json'), true);

const backupData = JSON.parse(fs.readFileSync('test-backup.json', 'utf8'));
assert.strictEqual(typeof backupData.timestamp, 'string');
assert.strictEqual(typeof backupData.data, 'object');
console.log('   ✓ Backup/Export çalışıyor');

console.log('✅ İçe/Dışa Aktarma Testi');
const exportData = db.export();
assert.strictEqual(typeof exportData, 'object');
assert.strictEqual(exportData['yedek.test'], 'yedek-değer');

db.clear();
assert.strictEqual(db.all().length, 0);

db.import({
    'test.import': 'imported-value',
    'nested.data.value': '42'
});
assert.strictEqual(db.get('test.import'), 'imported-value');
assert.strictEqual(db.get('nested.data.value'), '42');
console.log('   ✓ Import/Export çalışıyor');

console.log('✅ İstatistik Testi');
const stats = db.stats();
assert.strictEqual(typeof stats.totalKeys, 'number');
assert.strictEqual(typeof stats.totalSize, 'number');
assert.strictEqual(stats.filename, testFile);
console.log('   ✓ Stats çalışıyor');

console.log('✅ Silme İşlemleri Testi'); 
db.set('silinecek', 'değer');
assert.strictEqual(db.has('silinecek'), true);
const deleted = db.delete('silinecek');
assert.strictEqual(deleted, true);
assert.strictEqual(db.has('silinecek'), false);
console.log('   ✓ Delete çalışıyor');

console.log('✅ Performans Testi');
console.time('10,000 SET');
for (let i = 0; i < 10000; i++) {
    db.set(`perf_${i}`, `değer_${i}`);
}
console.timeEnd('10,000 SET');

console.time('10,000 GET');
for (let i = 0; i < 10000; i++) {
    db.get(`perf_${i}`);
}
console.timeEnd('10,000 GET');

console.time('SYNC');
db.sync();
console.timeEnd('SYNC');
console.log('   ✓ Performans testleri tamamlandı');

if (fs.existsSync(testFile)) {
    fs.unlinkSync(testFile);
}
if (fs.existsSync('test-backup.json')) {
    fs.unlinkSync('test-backup.json');
}

console.log('\n🎉 Tüm testler başarıyla geçti!');
console.log('FastDB hazır ve çalışıyor! 🚀'); 