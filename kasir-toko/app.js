let salesChartInstance = null;
let timerPencarianStok;
let timerPencarianKasir;
let timerOpname;
let hideModal = false;

let tokoSettings = JSON.parse(localStorage.getItem('sp_settings_v5')) || { namaToko: 'Toko Sparepart', fotoProfil: '' };
let tempBase64Foto = '';

const defaultItems = [
  { kode: '33700-GB6-921', nama: 'BOLHAM STOP (GB6) MS', merk: 'AHM', tempat: 'MUMU', stok: 0, modal: 11050, jual: 17000, bengkel: 25000, motor: 'Grand, Supra, Vario' },
  { kode: '09471-12101', nama: 'BOLHAM STOP SMASH', merk: 'SGP', tempat: 'IWAN', stok: 8, modal: 10625, jual: 17000, bengkel: 25000, motor: 'Smash, Shogun, Spin' }
];

let items = JSON.parse(localStorage.getItem('sp_items_v6')) || JSON.parse(localStorage.getItem('sp_items_v5')) || defaultItems;
let logs = JSON.parse(localStorage.getItem('sp_logs_v6')) || [];
let logsBelanja = JSON.parse(localStorage.getItem('sp_belanja_v1')) || []; 
let keranjang = []; 
let draftOpname = [];

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById('filterTanggal')) document.getElementById('filterTanggal').valueAsDate = new Date();
  if (document.getElementById('rekapTanggal')) document.getElementById('rekapTanggal').valueAsDate = new Date();
  if (document.getElementById('filterTanggalBelanja')) document.getElementById('filterTanggalBelanja').valueAsDate = new Date();
  
  applyTema(); 
  terapkanPengaturanUI(); 
  updateStats();
  renderRestockList();
  renderDropdownKasir();
  initOpname();
  switchTab('beranda');
});

function renderGrafik() {
  const ctxEl = document.getElementById('salesChart');
  if(!ctxEl) return;
  const ctx = ctxEl.getContext('2d');
  
  const labels = []; const dataOmzet = []; const dataLaba = [];
  for(let i=6; i>=0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const dateStr = d.toLocaleDateString('id-ID'); labels.push(dateStr.substring(0, 5)); 
    let omzetHarian = 0; let labaHarian = 0;
    logs.forEach(l => {
      if(l.tanggal.startsWith(dateStr) && l.status === 'Lunas') {
        const hrgPakai = l.grosir || l.harga; const sub = hrgPakai * l.qty; const mod = l.modal * l.qty;
        omzetHarian += sub; labaHarian += (sub - mod);
      }
    });
    dataOmzet.push(omzetHarian); dataLaba.push(labaHarian);
  }

  if(salesChartInstance) salesChartInstance.destroy();
  const isDark = localStorage.getItem('sp_theme') === 'dark';
  const textColor = isDark ? '#d4d4d8' : '#3f3f46'; const gridColor = isDark ? '#27272a' : '#e4e4e7';

  salesChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        { label: 'Omzet (Grosir)', data: dataOmzet, borderColor: '#dc2626', backgroundColor: 'rgba(220, 38, 38, 0.1)', borderWidth: 3, fill: true, tension: 0.3 },
        { label: 'Laba Bersih', data: dataLaba, borderColor: '#059669', backgroundColor: 'rgba(5, 150, 105, 0.1)', borderWidth: 3, fill: true, tension: 0.3 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: textColor } } },
      scales: {
        y: { ticks: { color: textColor }, grid: { color: gridColor } },
        x: { ticks: { color: textColor }, grid: { color: gridColor } }
      }
    }
  });
}

function cariBarangDebounce() { 
  clearTimeout(timerPencarianStok); 
  timerPencarianStok = setTimeout(() => { requestAnimationFrame(() => renderInventory()); }, 200); 
}

function cariKasirDebounce() { 
  clearTimeout(timerPencarianKasir); 
  timerPencarianKasir = setTimeout(() => { requestAnimationFrame(() => renderDropdownKasir()); }, 200); 
}

function applyTema() {
  const isDark = localStorage.getItem('sp_theme') === 'dark';
  if (isDark) { document.documentElement.classList.add('dark'); if(document.getElementById('iconTemaSidebar')) document.getElementById('iconTemaSidebar').className = 'fa-solid fa-sun text-xl lg:text-base text-zinc-500 group-hover:text-red-500 transition-colors'; if(document.getElementById('iconTema')) document.getElementById('iconTema').className = 'fa-solid fa-sun text-lg'; } 
  else { document.documentElement.classList.remove('dark'); if(document.getElementById('iconTemaSidebar')) document.getElementById('iconTemaSidebar').className = 'fa-solid fa-moon text-xl lg:text-base text-zinc-500 group-hover:text-red-500 transition-colors'; if(document.getElementById('iconTema')) document.getElementById('iconTema').className = 'fa-solid fa-moon text-lg'; }
  renderGrafik();
}

function toggleTema() { localStorage.setItem('sp_theme', localStorage.getItem('sp_theme') === 'dark' ? 'light' : 'dark'); applyTema(); }

function togglePrivacy() {
  hideModal = !hideModal;
  const btn = document.getElementById('btnPrivacy'); const icon = document.getElementById('iconPrivacy'); 
  if (hideModal) {
    if(btn) btn.className = 'bg-orange-600 hover:bg-orange-700 text-white px-4 py-2.5 rounded-md text-xs font-bold transition flex items-center gap-2 uppercase tracking-wider shadow-sm cursor-pointer';
    if(icon) icon.className = 'fa-solid fa-eye';
  } else {
    if(btn) btn.className = 'bg-zinc-800 hover:bg-zinc-900 text-white px-4 py-2.5 rounded-md text-xs font-bold transition flex items-center gap-2 uppercase tracking-wider shadow-sm cursor-pointer';
    if(icon) icon.className = 'fa-solid fa-eye-slash';
  }
  renderInventory(); updateStats();
  if(document.getElementById('sec-opname') && !document.getElementById('sec-opname').classList.contains('hidden')) kalkulasiTotalOpname(); 
  if(document.getElementById('sec-rekap') && !document.getElementById('sec-rekap').classList.contains('hidden')) renderRekap(); 
  if(document.getElementById('sec-riwayat-belanja') && !document.getElementById('sec-riwayat-belanja').classList.contains('hidden')) renderRiwayatBelanja(); 
}

function terapkanPengaturanUI() {
  if(document.getElementById('uiShopName')) document.getElementById('uiShopName').innerText = tokoSettings.namaToko; 
  const uiPic = document.getElementById('uiProfilePic'); const uiIco = document.getElementById('uiProfileIcon'); 
  if(uiPic && uiIco) {
    if (tokoSettings.fotoProfil) { uiPic.src = tokoSettings.fotoProfil; uiPic.classList.remove('hidden'); uiIco.classList.add('hidden'); } 
    else { uiPic.classList.add('hidden'); uiIco.classList.remove('hidden'); }
  }
}

function bukaModalPengaturan() {
  document.getElementById('setNamaToko').value = tokoSettings.namaToko; tempBase64Foto = tokoSettings.fotoProfil;
  const pPic = document.getElementById('previewSetFoto'); const pIco = document.getElementById('previewSetIcon');
  if (tempBase64Foto) { pPic.src = tempBase64Foto; pPic.classList.remove('hidden'); pIco.classList.add('hidden'); } else { pPic.classList.add('hidden'); pIco.classList.remove('hidden'); }
  document.getElementById('modalPengaturan').classList.remove('hidden'); document.getElementById('modalPengaturan').classList.add('flex');
}

function tutupModalPengaturan() { document.getElementById('modalPengaturan').classList.add('hidden'); document.getElementById('modalPengaturan').classList.remove('flex'); }

function uploadFotoProfil(event) {
  const file = event.target.files[0]; if (!file) return; const reader = new FileReader();
  reader.onload = function(e) { tempBase64Foto = e.target.result; document.getElementById('previewSetFoto').src = tempBase64Foto; document.getElementById('previewSetFoto').classList.remove('hidden'); document.getElementById('previewSetIcon').classList.add('hidden'); }; reader.readAsDataURL(file);
}

function simpanPengaturan() {
  tokoSettings.namaToko = document.getElementById('setNamaToko').value.trim() || 'Toko Sparepart'; tokoSettings.fotoProfil = tempBase64Foto;
  localStorage.setItem('sp_settings_v5', JSON.stringify(tokoSettings)); terapkanPengaturanUI(); tutupModalPengaturan();
}

function saveData() { 
  localStorage.setItem('sp_items_v6', JSON.stringify(items)); 
  localStorage.setItem('sp_logs_v6', JSON.stringify(logs)); 
  localStorage.setItem('sp_belanja_v1', JSON.stringify(logsBelanja)); 
  
  updateStats(); 
  renderRestockList();   
  renderDropdownKasir(); 
  initOpname(); 
  
  if(!document.getElementById('sec-rekap').classList.contains('hidden')) renderRekap();
  if(!document.getElementById('sec-riwayat-belanja').classList.contains('hidden')) renderRiwayatBelanja();
  if(!document.getElementById('sec-statistik').classList.contains('hidden')) renderGrafik();
}

function formatRp(num) { return (!num || num === 0) ? '-' : 'Rp ' + Number(num).toLocaleString('id-ID'); }

function badgeTempat(ket) {
  const k = String(ket || '').toUpperCase().trim();
  if (k === 'MUMU') return '<span class="px-2 py-0.5 rounded text-[10px] font-extrabold bg-blue-100 text-blue-800 border border-blue-200">MUMU</span>';
  if (k === 'IWAN') return '<span class="px-2 py-0.5 rounded text-[10px] font-extrabold bg-orange-100 text-orange-800 border border-orange-200">IWAN</span>';
  if (k === 'ONLINE') return '<span class="px-2 py-0.5 rounded text-[10px] font-extrabold bg-purple-100 text-purple-800 border border-purple-200">ONLINE</span>';
  return `<span class="px-2 py-0.5 rounded text-[10px] font-extrabold bg-zinc-100 text-zinc-700 border border-zinc-200">${k || '-'}</span>`;
}

function badgeMerk(merk) { return `<span class="text-xs font-extrabold text-zinc-600 tracking-wide">${String(merk || 'POLOS').toUpperCase().trim()}</span>`; }

function renderInventory() {
  const q = document.getElementById('searchInput').value.toLowerCase(); const t = document.getElementById('filterTempat').value;
  const tbody = document.getElementById('inventoryBody'); 
  let htmlStr = ''; let maxRender = 0;

  for(let i=0; i<items.length; i++) {
    if(maxRender >= 150) break;
    const item = items[i];
    const motorStr = (item.motor || '').toLowerCase(); const kodeStr = (item.kode || '').toLowerCase();
    const matchQ = item.nama.toLowerCase().includes(q) || item.merk.toLowerCase().includes(q) || motorStr.includes(q) || kodeStr.includes(q);
    const matchT = (t === 'ALL') || (item.tempat.toUpperCase() === t);
    
    if (matchQ && matchT) {
      maxRender++;
      const tampilModal = hideModal ? '<span class="text-zinc-400 font-mono">Rp ***</span>' : formatRp(item.modal);
      const infoMotor = item.motor ? `<p class="text-[10px] text-zinc-500 font-bold mt-1 uppercase tracking-wide"><i class="fa-solid fa-motorcycle mr-1"></i>${item.motor}</p>` : '';
      const badgeKode = item.kode && item.kode !== '-' ? `<span class="text-[10px] bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 px-1.5 py-0.5 rounded font-mono font-bold mr-2 border border-zinc-300 dark:border-zinc-600">${item.kode}</span>` : '';

      htmlStr += `
        <tr class="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800 transition">
          <td class="py-3 px-4 leading-snug"><div class="flex items-start">${badgeKode}<p class="font-bold text-zinc-800 dark:text-zinc-100">${item.nama}</p></div>${infoMotor}</td>
          <td class="py-3 px-3">${badgeMerk(item.merk)}</td>
          <td class="py-3 px-3">${badgeTempat(item.tempat)}</td>
          <td class="py-3 px-3 text-center font-extrabold text-lg ${item.stok <= 2 ? 'text-red-600 bg-red-50 dark:bg-red-900/20 rounded' : 'text-zinc-800 dark:text-zinc-100'}">${item.stok}</td>
          <td class="py-3 px-3 text-right text-zinc-500 font-medium">${tampilModal}</td>
          <td class="py-3 px-3 text-right font-extrabold text-red-600 dark:text-red-400">${formatRp(item.jual)}</td>
          <td class="py-3 px-3 text-right font-extrabold text-emerald-600 dark:text-emerald-400">${formatRp(item.bengkel)}</td>
          <td class="py-3 px-3 text-center">
            <div class="flex items-center justify-center gap-1.5">
              <button onclick="bukaModalEditBarang(${i})" class="w-8 h-8 flex items-center justify-center bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded border border-zinc-200 dark:border-zinc-700 transition cursor-pointer"><i class="fa-solid fa-pen text-xs"></i></button>
              <button onclick="hapusBarang(${i})" class="w-8 h-8 flex items-center justify-center bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 rounded border border-red-100 dark:border-red-900 transition cursor-pointer"><i class="fa-solid fa-trash text-xs"></i></button>
            </div>
          </td>
        </tr>`;
    }
  }
  tbody.innerHTML = htmlStr;
}

function renderDropdownKasir() {
  const q = (document.getElementById('filterKasirBarang')?.value || '').toLowerCase(); const selectStok = document.getElementById('pilihBarangStok');
  let htmlStr = ''; let maxRender = 0;
  for(let i=0; i<items.length; i++){
    if(maxRender >= 50) break;
    const it = items[i];
    if(it.nama.toLowerCase().includes(q) || it.merk.toLowerCase().includes(q) || (it.motor || '').toLowerCase().includes(q) || (it.kode || '').toLowerCase().includes(q)) {
      const dKode = it.kode && it.kode !== '-' ? `[${it.kode}] ` : ''; 
      htmlStr += `<option value="${i}">${dKode}${it.nama} [${it.merk}] — Stok: ${it.stok}</option>`;
      maxRender++;
    }
  }
  if(selectStok) selectStok.innerHTML = htmlStr;
}

function bukaModalEditBarang(idx) {
  const item = items[idx]; document.getElementById('editIdx').value = idx; 
  document.getElementById('editKode').value = item.kode && item.kode !== '-' ? item.kode : ''; document.getElementById('editNama').value = item.nama; document.getElementById('editMotor').value = item.motor || '';
  document.getElementById('editMerk').value = item.merk; document.getElementById('editTempat').value = item.tempat.toUpperCase(); document.getElementById('editStok').value = item.stok; document.getElementById('editModal').value = item.modal; 
  document.getElementById('editJual').value = item.jual; document.getElementById('editBengkel').value = item.bengkel;
  document.getElementById('modalEditBarang').classList.remove('hidden'); document.getElementById('modalEditBarang').classList.add('flex');
}

function tutupModalBarang() { document.getElementById('modalEditBarang').classList.add('hidden'); document.getElementById('modalEditBarang').classList.remove('flex'); }

function simpanEditBarang() {
  const idx = parseInt(document.getElementById('editIdx').value);
  items[idx] = {
    kode: document.getElementById('editKode').value.trim().toUpperCase() || '-', nama: document.getElementById('editNama').value.trim().toUpperCase(), motor: document.getElementById('editMotor').value.trim(), merk: (document.getElementById('editMerk').value.trim() || 'POLOS').toUpperCase(),
    tempat: document.getElementById('editTempat').value, stok: parseInt(document.getElementById('editStok').value) || 0, modal: parseInt(document.getElementById('editModal').value) || 0, jual: parseInt(document.getElementById('editJual').value) || 0, bengkel: parseInt(document.getElementById('editBengkel').value) || 0
  };
  saveData(); renderInventory(); tutupModalBarang();
}

function hapusBarang(idx) { if (confirm(`Hapus barang "${items[idx].nama}"?`)) { items.splice(idx, 1); saveData(); renderInventory(); } }

function renderRestockList() {
  const cont = document.getElementById('restockContainer'); if (!cont) return; const lokasi = ['MUMU', 'IWAN', 'ONLINE'];
  cont.innerHTML = lokasi.map(lok => {
    const habis = items.filter(i => i.tempat.toUpperCase() === lok && i.stok <= 2);
    return `
      <div class="border border-zinc-200 rounded-lg p-5 bg-zinc-50 flex flex-col justify-between shadow-sm">
        <div>
          <div class="flex justify-between items-center mb-4">${badgeTempat(lok)}<span class="text-[10px] font-extrabold text-white bg-red-600 px-2 py-0.5 rounded tracking-widest">${habis.length} LIMIT</span></div>
          <ul class="text-xs space-y-2 max-h-48 overflow-y-auto mb-4 pr-1 custom-scrollbar">
            ${habis.map(h => `<li class="bg-white p-2.5 rounded border border-zinc-200 flex justify-between items-center shadow-sm mb-1.5"><div><p class="font-bold text-zinc-800">${h.nama}</p><p class="text-[10px] font-bold text-zinc-400 tracking-wider uppercase">${h.merk}</p></div><span class="px-2 py-1 bg-zinc-100 text-red-600 font-extrabold rounded text-lg border border-zinc-200">${h.stok}</span></li>`).join('') || '<li class="text-zinc-400 font-medium text-center py-4 border border-dashed border-zinc-300 rounded bg-white">Stok Aman</li>'}
          </ul>
        </div>
        <button onclick="kirimWAGrosir('${lok}')" class="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-xs transition flex items-center justify-center gap-2 uppercase tracking-wider shadow-sm cursor-pointer"><i class="fa-brands fa-whatsapp text-sm"></i> Order</button>
      </div>`;
  }).join('');
}

function kirimWAGrosir(lokasi) {
  const habis = items.filter(i => i.tempat.toUpperCase() === lokasi && i.stok <= 2);
  if (habis.length === 0) return alert(`Tidak ada pesanan untuk ${lokasi}.`);
  let teks = `Halo Bos *${lokasi}*, mau order:\n\n` + habis.map((h, i) => `${i + 1}. ${h.nama} (${h.merk}) - Sisa: ${h.stok}`).join('\n') + `\n\nMohon info stok & total. Trims!`;
  navigator.clipboard.writeText(teks); if (confirm(`Pesanan disalin!\nKlik OK buka WhatsApp.`)) window.open(`https://wa.me/?text=${encodeURIComponent(teks)}`, '_blank');
}

// FUNGSI BARU: Pengecekan cerdas dan indikator warna saat input belanja
function cekHargaLama() {
  const kode = document.getElementById('belKode').value.trim().toUpperCase(); 
  const nama = document.getElementById('belNama').value.trim().toUpperCase(); 
  const merk = (document.getElementById('belMerk').value.trim() || 'POLOS').toUpperCase(); 
  const modalBaru = parseInt(document.getElementById('belModal').value) || 0;
  
  const boxHarga = document.getElementById('alertHargaNaik'); 
  const txtHarga = document.getElementById('alertHargaText');
  const boxBaru = document.getElementById('statusBarangBaru');
  const boxLama = document.getElementById('statusBarangLama');

  // Bersihkan semua indikator dulu setiap kali ngetik
  if(boxHarga) boxHarga.classList.add('hidden');
  if(boxBaru) boxBaru.classList.add('hidden');
  if(boxLama) boxLama.classList.add('hidden');

  if (!nama && !kode) return; // Jika kolom kosong, abaikan.

  let existing = null;
  // Cek berdasar kode atau nama+merk
  if (kode && kode !== '-') existing = items.find(i => i.kode === kode && i.kode !== '-');
  if (!existing && nama) existing = items.find(i => i.nama.toUpperCase() === nama && i.merk.toUpperCase() === merk);

  if (existing) {
    // BARANG DITEMUKAN (Warna Hijau)
    if(boxLama) {
      boxLama.classList.remove('hidden');
      document.getElementById('textBarangLama').innerText = `Sisa stok saat ini: ${existing.stok} pcs. Modal sebelumnya: ${formatRp(existing.modal)}`;
    }
    // Cek jika harganya naik (Warna Oranye)
    if (modalBaru > 0 && modalBaru > existing.modal) { 
      if(boxHarga) boxHarga.classList.remove('hidden'); 
      if(txtHarga) txtHarga.innerHTML = `<b>PERHATIAN! MODAL NAIK!</b><br>Harga lama <b>${formatRp(existing.modal)}</b> (Naik <b>Rp${(modalBaru - existing.modal).toLocaleString('id-ID')}</b>).<br>Sesuaikan harga jual!`; 
    }
  } else {
    // BARANG BARU DITEMUKAN (Warna Ungu) 
    // Syarat: huruf yang diketik sudah lebih dari 2 agar tidak terus-terusan kedip.
    if (nama.length > 2 || kode.length > 2) {
      if(boxBaru) boxBaru.classList.remove('hidden');
    }
  }
}

function updateStats() {
  let omzetLunasHariIni = 0, labaLunasHariIni = 0, totalKasbon = 0; const today = new Date().toLocaleDateString('id-ID'); 
  logs.forEach(l => { 
    const subtotal = l.harga * l.qty; const modalTotal = l.modal * l.qty;
    if (l.status === 'Kasbon') totalKasbon += subtotal; else if (l.tanggal.startsWith(today)) { omzetLunasHariIni += subtotal; labaLunasHariIni += (subtotal - modalTotal); }
  });
  if(document.getElementById('stat-omzet')) {
    document.getElementById('stat-omzet').innerText = formatRp(omzetLunasHariIni); document.getElementById('stat-laba').innerText = hideModal ? 'Rp ***' : formatRp(labaLunasHariIni); document.getElementById('stat-kasbon').innerText = formatRp(totalKasbon);
  }
}

function tambahKeKeranjangStok() {
  const idx = parseInt(document.getElementById('pilihBarangStok').value); const qty = parseInt(document.getElementById('qtyStok').value) || 1;
  const tipe = document.getElementById('notaTipeHarga').value; const item = items[idx];
  if (!item || item.stok < qty) return alert('Peringatan: Stok tidak mencukupi!');
  keranjang.push({ idxStok: idx, nama: `${item.nama} (${item.merk})`, qty: qty, modal: item.modal, harga: (tipe === 'bengkel' && item.bengkel > 0) ? item.bengkel : item.jual, grosir: item.jual }); renderKeranjang();
}

function tambahKeKeranjangManual() {
  const nama = document.getElementById('manualNama').value.trim(); const harga = parseInt(document.getElementById('manualHarga').value) || 0;
  if (!nama || harga <= 0) return alert('Isi nama item & harga dengan benar!');
  keranjang.push({ idxStok: null, nama: nama + ' (Manual)', qty: 1, modal: 0, harga: harga, grosir: harga }); document.getElementById('manualNama').value = ''; document.getElementById('manualHarga').value = ''; renderKeranjang();
}

function renderKeranjang() {
  const list = document.getElementById('keranjangList'); let total = 0;
  list.innerHTML = keranjang.map((k, i) => { total += k.harga * k.qty;
    return `<div class="flex justify-between items-center bg-white p-3 rounded border border-zinc-200 shadow-sm mb-2"><div><p class="font-bold text-zinc-800 text-sm uppercase">${k.nama}</p><p class="text-xs font-bold text-zinc-400 mt-1">${k.qty} x ${formatRp(k.harga)}</p></div><button onclick="keranjang.splice(${i},1);renderKeranjang()" class="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-2 rounded transition cursor-pointer"><i class="fa-solid fa-trash"></i></button></div>`;
  }).join('');
  document.getElementById('keranjangTotal').innerText = formatRp(total);
}

function salinNotaWA() {
  if (keranjang.length === 0) return alert('Nota masih kosong!');
  const pelanggan = document.getElementById('notaPelanggan').value || 'Pelanggan'; const isKasbon = document.getElementById('notaStatusBayar').value === 'Kasbon';
  let total = 0; let teks = `*NOTA TOKO ${tokoSettings.namaToko.toUpperCase()}*\nTanggal: ${new Date().toLocaleDateString('id-ID')}\nPelanggan: ${pelanggan}\nStatus: ${isKasbon ? '❌ KASBON' : '✅ LUNAS'}\n----------------------\n`;
  keranjang.forEach((k, i) => { const sub = k.harga * k.qty; total += sub; teks += `${i + 1}. ${k.nama} (${k.qty}x) = Rp${sub.toLocaleString('id-ID')}\n`; });
  teks += `----------------------\n*TOTAL TAGIHAN: Rp${total.toLocaleString('id-ID')}*\nTerima kasih!`; navigator.clipboard.writeText(teks); if (confirm('Nota disalin!\nBuka WhatsApp?')) window.open(`https://wa.me/?text=${encodeURIComponent(teks)}`, '_blank');
}

function cetakStrukNota() {
  if (keranjang.length === 0) return alert('Nota masih kosong!');
  const pelanggan = document.getElementById('notaPelanggan').value || 'Umum'; const isKasbon = document.getElementById('notaStatusBayar').value === 'Kasbon'; let total = 0; 
  let html = `<div class="text-center border-b-2 border-black pb-2 mb-3"><h2 class="font-extrabold text-lg uppercase tracking-wide m-0">${tokoSettings.namaToko.toUpperCase()}</h2><p class="m-0 mt-1 text-[10px]">${new Date().toLocaleString('id-ID')}</p><p class="m-0 font-bold mt-1">Cust: ${pelanggan}</p><p class="font-extrabold uppercase mt-2 border-2 border-black inline-block px-3 py-1 bg-gray-200 text-black tracking-widest">${isKasbon ? 'KASBON / PIUTANG' : 'LUNAS'}</p></div><div class="space-y-2 border-b-2 border-black pb-3 mb-3">`;
  keranjang.forEach(k => { const sub = k.harga * k.qty; total += sub; html += `<div style="display:flex; justify-content:space-between; font-weight:bold;"><span>${k.nama} x${k.qty}</span><span>Rp${sub.toLocaleString('id-ID')}</span></div>`; });
  html += `</div><div style="display:flex; justify-content:space-between; font-weight:bold; font-size:14px;"><span>TOTAL:</span><span>Rp${total.toLocaleString('id-ID')}</span></div><p class="text-center mt-6 font-bold uppercase tracking-widest text-[10px]">Terima Kasih</p>`;
  document.getElementById('main-app').classList.add('no-print'); document.getElementById('print-area').innerHTML = html; document.getElementById('print-area').classList.remove('hidden'); window.print(); document.getElementById('print-area').classList.add('hidden'); document.getElementById('main-app').classList.remove('no-print');
}

function prosesNotaSelesai() {
  if (keranjang.length === 0) return alert('Nota kosong!');
  const pelanggan = document.getElementById('notaPelanggan').value || 'Umum'; const statusBayar = document.getElementById('notaStatusBayar').value;
  if (statusBayar === 'Kasbon' && (pelanggan === 'Umum' || pelanggan === '')) return alert('Wajib isi Nama Pelanggan untuk pencatatan Kasbon!');
  keranjang.forEach(k => {
    if (k.idxStok !== null && items[k.idxStok]) items[k.idxStok].stok -= k.qty;
    logs.push({ tanggal: new Date().toLocaleDateString('id-ID') + ' ' + new Date().toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'}), pelanggan: pelanggan, idxStok: k.idxStok, nama: k.nama, qty: k.qty, modal: k.modal, harga: k.harga, grosir: k.grosir, status: statusBayar });
  });
  saveData(); document.getElementById('filterTanggal').valueAsDate = new Date(); alert(`Transaksi Berhasil!`); keranjang = []; document.getElementById('notaPelanggan').value = ''; renderKeranjang();
}

function simpanBelanjaStok() {
  const kode = document.getElementById('belKode').value.trim().toUpperCase() || '-'; const nama = document.getElementById('belNama').value.trim().toUpperCase(); const merk = (document.getElementById('belMerk').value.trim() || 'POLOS').toUpperCase(); const tempat = document.getElementById('belTempat').value; const stok = parseInt(document.getElementById('belStok').value) || 0; const modal = parseInt(document.getElementById('belModal').value) || 0; const jual = parseInt(document.getElementById('belJual').value) || 0; const bengkel = parseInt(document.getElementById('belBengkel').value) || 0; const motor = document.getElementById('belMotor').value.trim();
  if (!nama) return alert('NAMA BARANG wajib diisi!'); if (stok <= 0) return alert('Jumlah stok tidak boleh kosong/nol!');
  let existing = null; if (kode !== '-') existing = items.find(i => i.kode === kode && i.kode !== '-'); if (!existing) existing = items.find(i => i.nama.toUpperCase() === nama && i.merk.toUpperCase() === merk);
  if (existing) {
    existing.stok += stok; if (kode !== '-') existing.kode = kode; if (modal > 0) existing.modal = modal; if (jual > 0) existing.jual = jual; if (bengkel > 0) existing.bengkel = bengkel; if (motor) existing.motor = motor; existing.tempat = tempat;
  } else { items.push({ kode, nama, merk, tempat, stok, modal, jual, bengkel, motor }); }
  logsBelanja.push({ tanggal: new Date().toLocaleDateString('id-ID') + ' ' + new Date().toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'}), kode: kode, nama: nama, merk: merk, tempat: tempat, qty: stok, modal: modal, total: stok * modal });
  
  // Sembunyikan tanda setelah data sukses tersimpan
  if(document.getElementById('alertHargaNaik')) document.getElementById('alertHargaNaik').classList.add('hidden'); 
  if(document.getElementById('statusBarangBaru')) document.getElementById('statusBarangBaru').classList.add('hidden');
  if(document.getElementById('statusBarangLama')) document.getElementById('statusBarangLama').classList.add('hidden');
  
  saveData(); alert(`Data Stok Masuk Tersimpan!\nData tercatat di Riwayat Belanja.`); document.getElementById('belKode').value = ''; document.getElementById('belNama').value = ''; document.getElementById('belStok').value = '10';
}

function renderRiwayatBelanja() {
  const tbody = document.getElementById('logBelanjaBody'); const filterInput = document.getElementById('filterTanggalBelanja').value; const dateSelected = filterInput ? new Date(filterInput).toLocaleDateString('id-ID') : new Date().toLocaleDateString('id-ID');
  let totalKeluar = 0; const filtered = logsBelanja.map((l, originalIdx) => ({...l, originalIdx})).filter(l => { const isCocok = l.tanggal.startsWith(dateSelected); if(isCocok) totalKeluar += l.total; return isCocok; });
  document.getElementById('summaryRiwayatBelanja').innerHTML = `<div class="flex flex-col"><span class="text-[10px] text-zinc-400 uppercase tracking-widest mb-1">Total Pengeluaran (Belanja) Tgl Ini</span><span class="text-2xl text-blue-400 tracking-tight">${hideModal ? 'Rp ***' : formatRp(totalKeluar)}</span></div>`;
  tbody.innerHTML = filtered.map(l => `<tr class="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800 transition"><td class="py-3 px-3 text-zinc-500 font-medium">${l.tanggal}</td><td class="py-3 px-3 font-extrabold text-blue-600 dark:text-blue-400 uppercase">${l.tempat}</td><td class="py-3 px-3 font-bold text-zinc-700 dark:text-zinc-300 uppercase">${l.kode !== '-' ? '<span class="text-[10px] text-zinc-400 font-mono tracking-widest mr-1">['+l.kode+']</span>' : ''}${l.nama}</td><td class="py-3 px-3 text-center font-extrabold text-lg">${l.qty}</td><td class="py-3 px-3 text-right font-medium text-zinc-500">${formatRp(l.modal)}</td><td class="py-3 px-3 text-right font-extrabold text-blue-600">${formatRp(l.total)}</td><td class="py-3 px-3 text-center"><button onclick="batalBelanja(${l.originalIdx})" class="px-3 py-1 bg-white border border-zinc-300 hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-zinc-500 rounded text-[10px] font-extrabold uppercase tracking-widest transition shadow-sm cursor-pointer">Batal</button></td></tr>`).reverse().join('') || `<tr><td colspan="7" class="py-12 text-center text-zinc-400 font-bold uppercase tracking-widest"><i class="fa-solid fa-box-open text-4xl block mb-3 opacity-30"></i>Tidak ada riwayat belanja/kulakan</td></tr>`;
}

function batalBelanja(idx) {
  const l = logsBelanja[idx];
  if(confirm(`BATALKAN DATA BELANJA INI?\n\nBarang: ${l.nama}\nQTY: ${l.qty}\n\nStok gudang akan otomatis ditarik kembali / dikurangi sesuai jumlah tersebut.`)) {
    let item = items.find(i => i.nama === l.nama && i.merk === l.merk && i.tempat === l.tempat); if(item) { item.stok -= l.qty; if(item.stok < 0) item.stok = 0; }
    logsBelanja.splice(idx, 1); saveData(); 
  }
}

function resetRiwayatBelanja() { if(confirm('PENTING: Yakin ingin menghapus seluruh log Riwayat Belanja secara permanen?')) { logsBelanja = []; saveData(); } }

function renderRekap() {
  const tglInput = document.getElementById('rekapTanggal').value; const dateSelected = tglInput ? new Date(tglInput).toLocaleDateString('id-ID') : new Date().toLocaleDateString('id-ID');
  const rekapBody = document.getElementById('rekapBody'); let omzetGrosirLunas = 0, labaGrosirLunas = 0, piutangGrosirKasbon = 0; let html = '';
  const logsHariIni = logs.filter(l => l.tanggal.startsWith(dateSelected));

  logsHariIni.forEach(l => {
    const hargaGrosirPakai = l.grosir || l.harga; const subGrosir = hargaGrosirPakai * l.qty; const modalTotal = l.modal * l.qty;
    if (l.status === 'Lunas') { omzetGrosirLunas += subGrosir; labaGrosirLunas += (subGrosir - modalTotal); } else { piutangGrosirKasbon += subGrosir; }
    const jam = l.tanggal.split(' ')[1] || '-'; const statusBadge = l.status === 'Lunas' ? `<span class="text-emerald-600 font-bold">LUNAS</span>` : `<span class="text-orange-600 font-bold">KASBON</span>`;
    html += `<tr class="hover:bg-zinc-50 border-b border-zinc-100"><td class="py-3 px-3 text-zinc-500 font-mono text-[10px]">${jam}</td><td class="py-3 px-3 text-[10px]">${statusBadge}</td><td class="py-3 px-3 font-bold text-zinc-700">${l.nama}</td><td class="py-3 px-3 text-center font-extrabold">${l.qty}</td><td class="py-3 px-3 text-right font-medium text-zinc-500">${formatRp(hargaGrosirPakai)}</td><td class="py-3 px-3 text-right font-extrabold ${l.status === 'Kasbon' ? 'text-orange-600' : 'text-zinc-800'}">${formatRp(subGrosir)}</td></tr>`;
  });
  document.getElementById('rekapUangMasuk').innerText = formatRp(omzetGrosirLunas); document.getElementById('rekapPiutang').innerText = formatRp(piutangGrosirKasbon); document.getElementById('rekapLaba').innerText = hideModal ? 'Rp ***' : formatRp(labaGrosirLunas);
  rekapBody.innerHTML = html || `<tr><td colspan="6" class="py-8 text-center text-zinc-400 font-bold uppercase tracking-widest"><i class="fa-solid fa-mug-hot text-3xl block mb-3 opacity-30"></i>Belum ada transaksi di tanggal ini</td></tr>`;
}

function cetakRekapHarian() {
  const tglInput = document.getElementById('rekapTanggal').value; const dateSelected = tglInput ? new Date(tglInput).toLocaleDateString('id-ID') : new Date().toLocaleDateString('id-ID');
  let omzetGrosirLunas = 0, labaGrosirLunas = 0, piutangGrosirKasbon = 0; const logsHariIni = logs.filter(l => l.tanggal.startsWith(dateSelected));
  let rincianHTML = '';
  logsHariIni.forEach(l => {
    const hargaGrosirPakai = l.grosir || l.harga; const subGrosir = hargaGrosirPakai * l.qty;
    if (l.status === 'Lunas') { omzetGrosirLunas += subGrosir; labaGrosirLunas += (subGrosir - (l.modal * l.qty)); } else { piutangGrosirKasbon += subGrosir; }
    const statusTxt = l.status === 'Lunas' ? '' : '(KASBON) '; rincianHTML += `<div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:4px;"><span>${statusTxt}${l.nama} x${l.qty}</span><span>Rp${subGrosir.toLocaleString('id-ID')}</span></div>`;
  });
  let html = `
    <div style="text-align:center; border-bottom: 2px dashed black; padding-bottom:10px; margin-bottom: 10px;"><h2 style="margin:0; font-size: 16px; font-weight:bold;">REKAP HARIAN GROSIR</h2><p style="margin:2px 0 0 0; font-size: 12px;">Toko: ${tokoSettings.namaToko}</p><p style="margin:0; font-size: 12px;">Tanggal: ${dateSelected}</p></div>
    <div style="border-bottom: 2px dashed black; padding-bottom:10px; margin-bottom: 10px;"><p style="margin:0 0 5px 0; font-size: 12px; font-weight:bold; text-align:center;">RINGKASAN TOTAL GROSIR</p><div style="display:flex; justify-content:space-between; font-size:12px; font-weight:bold;"><span>Total Penjualan:</span><span>Rp${omzetGrosirLunas.toLocaleString('id-ID')}</span></div><div style="display:flex; justify-content:space-between; font-size:12px; font-weight:bold;"><span>Piutang Kasbon:</span><span>Rp${piutangGrosirKasbon.toLocaleString('id-ID')}</span></div><div style="display:flex; justify-content:space-between; font-size:12px; font-weight:bold; margin-top:5px; padding-top:5px; border-top:1px solid black;"><span>Laba Bersih Grosir:</span><span>${hideModal ? '***' : 'Rp' + labaGrosirLunas.toLocaleString('id-ID')}</span></div></div>
    <div><p style="margin:0 0 5px 0; font-size: 12px; font-weight:bold;">RINCIAN BARANG KELUAR</p>${rincianHTML || '<p style="font-size:11px; text-align:center;">Tidak ada transaksi.</p>'}</div><p style="text-align:center; margin-top:20px; font-size:10px; font-weight:bold;">*** Laporan Internal Toko ***</p>
  `;
  document.getElementById('main-app').classList.add('no-print'); document.getElementById('print-area').innerHTML = html; document.getElementById('print-area').classList.remove('hidden'); window.print(); document.getElementById('print-area').classList.add('hidden'); document.getElementById('main-app').classList.remove('no-print');
}

function tandaiLunas(idx) {
  if (confirm(`Tandai LUNAS transaksi "${logs[idx].nama}" (${logs[idx].pelanggan})?\n\nAngka akan masuk ke perhitungan Omzet hari ini.`)) {
    logs[idx].status = 'Lunas'; logs[idx].tanggal = new Date().toLocaleDateString('id-ID') + ' ' + new Date().toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'});
    saveData(); renderRiwayat();
  }
}

function renderRiwayat() {
  const logBody = document.getElementById('logBody'); const filterInput = document.getElementById('filterTanggal').value; const dateSelected = filterInput ? new Date(filterInput).toLocaleDateString('id-ID') : new Date().toLocaleDateString('id-ID');
  let totalLunasTerfilter = 0; let labaTerfilter = 0;
  const logsFiltered = logs.map((l, originalIdx) => ({...l, originalIdx})).filter(l => {
    const isTanggalCocok = l.tanggal.startsWith(dateSelected);
    if (isTanggalCocok && l.status === 'Lunas') { totalLunasTerfilter += (l.harga * l.qty); labaTerfilter += ((l.harga - l.modal) * l.qty); }
    return isTanggalCocok || l.status === 'Kasbon'; 
  });
  document.getElementById('summaryRiwayat').innerHTML = `<div class="flex flex-col"><span class="text-[10px] text-zinc-400 uppercase tracking-widest mb-1">Omzet Kasir Tgl Ini (Nilai Riil)</span><span class="text-2xl tracking-tight">${formatRp(totalLunasTerfilter)}</span></div><div class="border-l border-zinc-700 mx-4"></div><div class="flex flex-col"><span class="text-[10px] text-zinc-400 uppercase tracking-widest mb-1">Laba Kasir Tgl Ini</span><span class="text-2xl text-emerald-400 tracking-tight">${hideModal ? 'Rp ***' : formatRp(labaTerfilter)}</span></div>`;
  logBody.innerHTML = logsFiltered.map(l => `<tr class="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800 transition"><td class="py-3 px-3">${l.status === 'Kasbon' ? `<span class="px-2 py-1 bg-orange-100 text-orange-700 font-extrabold rounded text-[10px] tracking-widest uppercase">KASBON</span>` : `<span class="px-2 py-1 bg-emerald-100 text-emerald-700 font-extrabold rounded text-[10px] tracking-widest uppercase">LUNAS</span>`}</td><td class="py-3 px-3 text-zinc-500 font-medium">${l.tanggal}</td><td class="py-3 px-3 font-extrabold text-zinc-800 dark:text-zinc-100 uppercase">${l.pelanggan || '-'}</td><td class="py-3 px-3 font-bold text-zinc-700 dark:text-zinc-300 uppercase">${l.nama}</td><td class="py-3 px-3 text-center font-extrabold text-lg">${l.qty}</td><td class="py-3 px-3 text-right font-extrabold ${l.status === 'Kasbon' ? 'text-orange-600' : 'text-emerald-600'}">${formatRp(l.harga * l.qty)}</td><td class="py-3 px-3 text-center"><div class="flex flex-col gap-1 items-center justify-center">${l.status === 'Kasbon' ? `<button onclick="tandaiLunas(${l.originalIdx})" class="w-full px-2 py-1.5 bg-zinc-900 hover:bg-black text-white rounded text-[10px] font-extrabold uppercase tracking-widest transition shadow-sm border border-zinc-700 cursor-pointer">LUNASI</button>` : ''}<div class="flex gap-1 justify-center w-full"><button onclick="returLog(${l.originalIdx})" class="w-full px-2 py-1 bg-white border border-zinc-300 hover:bg-red-50 hover:text-red-600 text-zinc-500 rounded text-[10px] font-extrabold uppercase tracking-widest transition cursor-pointer">Retur</button></div></div></td></tr>`).reverse().join('') || `<tr><td colspan="7" class="py-12 text-center text-zinc-400 font-bold uppercase tracking-widest"><i class="fa-solid fa-folder-open text-4xl block mb-3 opacity-30"></i>Tidak ada transaksi terdata</td></tr>`;
}

function bukaModalEditLog(idx) {
  const l = logs[idx]; document.getElementById('editLogIdx').value = idx; document.getElementById('editLogPelanggan').value = l.pelanggan || ''; 
  document.getElementById('editLogNama').value = l.nama; document.getElementById('editLogHarga').value = l.harga; 
  document.getElementById('modalEditLog').classList.remove('hidden'); document.getElementById('modalEditLog').classList.add('flex');
}
function tutupModalLog() { document.getElementById('modalEditLog').classList.add('hidden'); document.getElementById('modalEditLog').classList.remove('flex'); }
function simpanEditLog() {
  const idx = parseInt(document.getElementById('editLogIdx').value);
  logs[idx].pelanggan = document.getElementById('editLogPelanggan').value.trim(); logs[idx].nama = document.getElementById('editLogNama').value.trim();
  logs[idx].harga = parseInt(document.getElementById('editLogHarga').value) || 0; saveData(); renderRiwayat(); tutupModalLog();
}
function returLog(idx) {
  if (confirm(`PENTING: Retur barang "${logs[idx].nama}"?\n\nStok fisik akan dikembalikan dan omzet otomatis dikurangi.`)) {
    if (logs[idx].idxStok !== null && items[logs[idx].idxStok]) items[logs[idx].idxStok].stok += logs[idx].qty;
    logs.splice(idx, 1); saveData(); renderRiwayat();
  }
}
function resetRiwayatLunas() { if (confirm('Bersihkan Log Lunas hari ini? Data Kasbon akan tetap dipertahankan.')) { logs = logs.filter(l => l.status === 'Kasbon'); saveData(); renderRiwayat(); } }

function initOpname() { draftOpname = items.map(i => i.stok); kalkulasiTotalOpname(); }

function renderOpname() {
  if(draftOpname.length !== items.length) initOpname();
  const q = document.getElementById('cariOpnameInput').value.toLowerCase(); const tbody = document.getElementById('opnameBody'); 
  
  let htmlStr = ''; let maxRender = 0;

  for(let i=0; i<items.length; i++){
    if(maxRender >= 150) break;
    const item = items[i];
    const kodeStr = (item.kode || '').toLowerCase();
    
    if(!item.nama.toLowerCase().includes(q) && !kodeStr.includes(q)) continue;
    
    maxRender++;
    const selisih = draftOpname[i] - item.stok; const nominal = selisih * item.modal;
    let cssClass = 'text-zinc-400'; let iconTeks = '-';
    if(selisih < 0) { cssClass = 'text-red-600'; iconTeks = `${selisih} (${formatRp(nominal)})`; } else if (selisih > 0) { cssClass = 'text-emerald-600'; iconTeks = `+${selisih} (+${formatRp(nominal)})`; }
    const dKode = item.kode && item.kode !== '-' ? `<span class="text-zinc-500 font-mono text-[10px] block mb-0.5 tracking-wider">${item.kode}</span>` : '';
    
    htmlStr += `<tr class="border-b border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition"><td class="py-3 px-4 text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase">${dKode}${item.nama}</td><td class="py-3 px-3 text-center font-extrabold text-zinc-400 text-xl">${item.stok}</td><td class="py-3 px-3"><input type="number" value="${draftOpname[i]}" oninput="updateDraftOpname(${i}, this.value)" class="w-full p-2 border-2 border-zinc-300 bg-white dark:bg-zinc-950 dark:border-zinc-700 rounded text-center text-xl font-extrabold text-red-600 focus:border-red-600 outline-none transition shadow-inner"></td><td class="py-3 px-4 text-right text-xs font-extrabold tracking-wide ${cssClass}" id="opDiff_${i}">${hideModal && selisih !== 0 ? (selisih > 0 ? '+'+selisih : selisih) + ' (Rp ***)' : iconTeks}</td></tr>`;
  }
  tbody.innerHTML = htmlStr;
}

function renderOpnameDebounce() { clearTimeout(timerOpname); timerOpname = setTimeout(renderOpname, 300); }

function updateDraftOpname(idx, val) {
  const newVal = parseInt(val); draftOpname[idx] = isNaN(newVal) ? 0 : newVal;
  const selisih = draftOpname[idx] - items[idx].stok; const nominal = selisih * items[idx].modal;
  const tdDiff = document.getElementById(`opDiff_${idx}`);
  if(selisih < 0) { tdDiff.className = "py-3 px-4 text-right text-xs font-extrabold tracking-wide text-red-600"; tdDiff.innerText = hideModal ? `${selisih} (Rp ***)` : `${selisih} (${formatRp(nominal)})`; } else if (selisih > 0) { tdDiff.className = "py-3 px-4 text-right text-xs font-extrabold tracking-wide text-emerald-600"; tdDiff.innerText = hideModal ? `+${selisih} (Rp ***)` : `+${selisih} (+${formatRp(nominal)})`; } else { tdDiff.className = "py-3 px-4 text-right text-xs font-extrabold tracking-wide text-zinc-400"; tdDiff.innerText = `-`; }
  kalkulasiTotalOpname();
}

function kalkulasiTotalOpname() {
  let totalRugiLaba = 0; items.forEach((item, idx) => { totalRugiLaba += ((draftOpname[idx] - item.stok) * item.modal); });
  const el = document.getElementById('totalSelisihOpname');
  if(hideModal) { el.className = 'text-2xl font-extrabold text-zinc-400 leading-none mt-1 tracking-tight'; el.innerText = 'Rp ***'; return; }
  if(totalRugiLaba < 0) { el.className = 'text-2xl font-extrabold text-red-600 leading-none mt-1 tracking-tight'; el.innerText = formatRp(totalRugiLaba); } else if (totalRugiLaba > 0) { el.className = 'text-2xl font-extrabold text-emerald-600 leading-none mt-1 tracking-tight'; el.innerText = '+' + formatRp(totalRugiLaba); } else { el.className = 'text-2xl font-extrabold text-zinc-800 dark:text-zinc-200 leading-none mt-1 tracking-tight'; el.innerText = 'Rp 0 (Klop)'; }
}

function terapkanOpname() {
  if(confirm('WARNING: Angka fisik akan menimpa seluruh sistem stok gudang saat ini. Lanjutkan?')) {
    items.forEach((item, idx) => { item.stok = draftOpname[idx]; }); saveData(); renderInventory(); alert('SINKRONISASI STOK BERHASIL!'); initOpname(); renderOpname();
  }
}

function cetakFormOpname() {
  let html = `<div style="text-align:center; border-bottom: 3px solid black; padding-bottom:10px; margin-bottom: 15px;"><h2 style="margin:0; font-size: 22px; font-weight:900; letter-spacing: 1px;">FORM AUDIT STOCK OPNAME</h2><p style="margin:5px 0 0 0; font-size: 14px; font-weight:bold;">Tgl: ${new Date().toLocaleDateString('id-ID')} | Dicetak Dari: ${tokoSettings.namaToko}</p></div><table style="width:100%; border-collapse: collapse; font-size: 12px; font-family:sans-serif;" border="1"><thead><tr style="background:#f1f5f9;"><th style="padding: 10px; text-align:left;">KODE & NAMA PART</th><th style="padding: 10px; text-align:center; width:80px">LOKASI</th><th style="padding: 10px; text-align:center; width:70px">SISTEM</th><th style="padding: 10px; text-align:center; width:90px">FISIK</th><th style="padding: 10px; text-align:left; width:120px">KETERANGAN</th></tr></thead><tbody>`;
  items.forEach(i => { const dKode = i.kode && i.kode !== '-' ? `<b>[${i.kode}]</b> ` : ''; html += `<tr><td style="padding: 8px;">${dKode}${i.nama}</td><td style="padding: 8px; text-align:center; font-weight:bold;">${i.tempat}</td><td style="padding: 8px; text-align:center;">${i.stok}</td><td style="padding: 8px;"></td><td style="padding: 8px;"></td></tr>`; });
  html += `</tbody></table>`; document.getElementById('main-app').classList.add('no-print'); document.getElementById('print-area-opname').innerHTML = html; document.getElementById('print-area-opname').classList.remove('hidden'); window.print(); document.getElementById('print-area-opname').classList.add('hidden'); document.getElementById('main-app').classList.remove('no-print');
}

function parseCSVLine(line, delimiter) {
  let row = [''], d = 0, l = line.length, s = !0;
  for (let i = 0; i < l; i++) { let c = line[i]; if (c === '"') { s = !s; } else if (c === delimiter && s) { row.push(''); d++; } else { row[d] += c; } } return row.map(v => v.trim().replace(/^"|"$/g, ''));
}

function cleanRupiah(val) { if (!val) return 0; return parseInt(String(val).replace(/[^0-9]/g, ''), 10) || 0; }

function importCSV(event) {
  const file = event.target.files[0]; if (!file) return; const reader = new FileReader();
  reader.onload = function(e) {
    const text = e.target.result; const delimiter = text.indexOf(';') > -1 ? ';' : ','; const lines = text.split(/\r?\n/); let count = 0; const newItems = []; let formatBaru = false;
    lines.forEach((line, index) => {
      if (!line.trim()) return; const cols = parseCSVLine(line, delimiter);
      if (index === 0) { if(cols[0] && cols[0].toUpperCase().includes('KODE')) formatBaru = true; return; }
      let kode = '-', nama = '', merk = '', tempat = '', stok = 0, modal = 0, jual = 0, bengkel = 0, motor = '';
      if (formatBaru && cols.length >= 9) { kode = cols[0] || '-'; nama = cols[1]; merk = cols[2]; tempat = cols[3]; stok = cols[4]; modal = cols[5]; jual = cols[6]; bengkel = cols[7]; motor = cols[8]; } 
      else { kode = '-'; nama = cols[0]; merk = cols[1]; tempat = cols[2]; stok = cols[3]; modal = cols[4]; jual = cols[5]; bengkel = cols[6]; motor = cols[7]; }
      if (!nama || nama.toUpperCase().includes('NAMA BARANG')) return;
      newItems.push({ kode: kode.toUpperCase(), nama: nama.toUpperCase(), merk: (merk || 'POLOS').toUpperCase(), tempat: (tempat || 'MUMU').toUpperCase(), stok: cleanRupiah(stok), modal: cleanRupiah(modal), jual: cleanRupiah(jual), bengkel: cleanRupiah(bengkel), motor: motor || '' }); count++;
    });
    if (count > 0) { items = newItems; saveData(); renderInventory(); alert(`Berhasil sinkronisasi ${count} part ke database!`); document.getElementById('csvFileInput').value = ''; }
  }; reader.readAsText(file);
}

function exportCSV() {
  let csv = "KODE PART,NAMA BARANG,MERK,KET,QTY,MODAL (BELI),JUAL GROSIR,JUAL ECERAN,PERSAMAAN MOTOR\n";
  items.forEach(i => csv += `"${i.kode || '-'}","${i.nama}","${i.merk}","${i.tempat}",${i.stok},${i.modal},${i.jual},${i.bengkel},"${i.motor || ''}"\n`);
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'stok-terbaru-toko.csv'; a.click();
}

function switchTab(tab) {
  ['beranda', 'stok', 'kasir', 'belanja', 'riwayat', 'rekap', 'opname', 'riwayat-belanja', 'statistik'].forEach(t => { 
    if(document.getElementById('sec-' + t)) document.getElementById('sec-' + t).classList.add('hidden'); 
    let tabBtn = document.getElementById('tab-' + t);
    let mobBtn = document.getElementById('mob-tab-' + t);
    if(tabBtn) tabBtn.classList.remove('active-tab'); 
    if(mobBtn) { mobBtn.classList.remove('text-red-500'); mobBtn.classList.add('text-zinc-500'); }
  });
  
  if(document.getElementById('sec-' + tab)) document.getElementById('sec-' + tab).classList.remove('hidden'); 
  let activeBtn = document.getElementById('tab-' + tab);
  let activeMob = document.getElementById('mob-tab-' + tab);
  if(activeBtn) activeBtn.classList.add('active-tab');
  if(activeMob) { activeMob.classList.remove('text-zinc-500'); activeMob.classList.add('text-red-500'); }
  
  if (tab === 'stok') renderInventory();
  if (tab === 'riwayat') renderRiwayat(); 
  if (tab === 'belanja') renderRestockList(); 
  if (tab === 'kasir') renderDropdownKasir(); 
  if (tab === 'opname') renderOpname();
  if (tab === 'rekap') renderRekap();
  if (tab === 'riwayat-belanja') renderRiwayatBelanja();
  
  if (tab === 'statistik') { setTimeout(() => { renderGrafik(); }, 100); }
}
// ==========================================
// PENCARIAN & AUTO-FILL UNTUK TAB BELANJA
// ==========================================
let timerPencarianBelanja;

function cariBelanjaDebounce() {
  clearTimeout(timerPencarianBelanja);
  timerPencarianBelanja = setTimeout(() => { requestAnimationFrame(() => renderDropdownBelanja()); }, 200);
}

function renderDropdownBelanja() {
  const q = (document.getElementById('cariBarangBelanja')?.value || '').toLowerCase(); 
  const selectObj = document.getElementById('pilihBarangBelanja');
  
  if(q.trim() === '') {
    selectObj.innerHTML = '<option value="">-- Ketik pencarian di atas, lalu pilih barang di sini --</option>';
    return;
  }

  let htmlStr = '<option value="">-- Pilih barang di bawah ini --</option>'; 
  let maxRender = 0;
  
  for(let i=0; i<items.length; i++){
    if(maxRender >= 50) break;
    const it = items[i];
    if(it.nama.toLowerCase().includes(q) || it.merk.toLowerCase().includes(q) || (it.kode || '').toLowerCase().includes(q)) {
      const dKode = it.kode && it.kode !== '-' ? `[${it.kode}] ` : ''; 
      htmlStr += `<option value="${i}">${dKode}${it.nama} [${it.merk}] — Sisa: ${it.stok}</option>`;
      maxRender++;
    }
  }
  
  if(maxRender === 0) {
     htmlStr = '<option value="">-- Barang tidak ditemukan, isi form di bawah sebagai barang baru --</option>';
  }
  selectObj.innerHTML = htmlStr;
}

function autoFillBelanja() {
  const selectObj = document.getElementById('pilihBarangBelanja');
  const idx = selectObj.value;
  if(idx === "") return alert("Pilih barang dari kotak terlebih dahulu!"); 
  
  const item = items[parseInt(idx)];
  if(!item) return;

  // Isi otomatis form
  document.getElementById('belKode').value = item.kode && item.kode !== '-' ? item.kode : '';
  document.getElementById('belNama').value = item.nama;
  document.getElementById('belMerk').value = item.merk;
  document.getElementById('belTempat').value = item.tempat;
  document.getElementById('belModal').value = item.modal;
  document.getElementById('belJual').value = item.jual;
  document.getElementById('belBengkel').value = item.bengkel;
  document.getElementById('belMotor').value = item.motor || '';
  
  // Arahkan kursor langsung ke QTY Masuk
  document.getElementById('belStok').focus();
  
  // Nyalakan sensor warna indikator
  cekHargaLama();
}