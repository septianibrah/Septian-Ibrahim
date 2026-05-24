import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Gift, 
  Key, 
  CheckCircle2, 
  AlertCircle,
  Zap,
  Sparkles
} from 'lucide-react';
import { useAppStore } from '../store';

export default function AddLimit() {
  const navigate = useNavigate();
  const { aiLimit, aiRequestsToday, claimDailyBonus, redeemSecretCode, lastDailyClaim } = useAppStore();
  const [secretCode, setSecretCode] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const today = new Date().toDateString();
  const hasClaimedToday = lastDailyClaim === today;

  const handleClaimDaily = () => {
    const success = claimDailyBonus();
    if (success) {
      setMessage({ type: 'success', text: 'Harian: +5 poin ditambahkan!' });
    } else {
      setMessage({ type: 'error', text: 'Anda sudah mengambil bonus hari ini.' });
    }
  };

  const handleRedeem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!secretCode) return;
    
    const success = redeemSecretCode(secretCode);
    if (success) {
      setMessage({ type: 'success', text: `Kode Berhasil! +12 poin ditambahkan.` });
      setSecretCode('');
    } else {
      setMessage({ type: 'error', text: 'Kode rahasia tidak valid.' });
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0C] text-white font-sans selection:bg-blue-500/30">
      {/* Background Glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
        <div className="absolute top-[20%] -right-[10%] w-[30%] h-[30%] bg-purple-600/10 blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-6 py-12">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-white/40 hover:text-white transition-colors mb-12 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-xs font-bold uppercase tracking-widest">Kembali</span>
        </button>

        <header className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
              <Zap className="w-5 h-5 text-blue-400" />
            </div>
            <h1 className="text-3xl font-black italic uppercase tracking-tighter">Tambah Limit</h1>
          </div>
          <p className="text-white/40 text-sm leading-relaxed">
            Dapatkan poin ekstra untuk melanjutkan pembuatan kode dengan AI. 
            Gunakan poin untuk mengirim permintaan lebih banyak ke asisten cerdas Anda.
          </p>
        </header>

        {/* Current Stats */}
        <div className="grid grid-cols-2 gap-4 mb-12">
          <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/5 backdrop-blur-xl">
            <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest block mb-1">Limit Total</span>
            <span className="text-2xl font-black italic text-blue-400">{aiLimit} <span className="text-xs not-italic text-white/40">POIN</span></span>
          </div>
          <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/5 backdrop-blur-xl">
            <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest block mb-1">Terpakai Hari Ini</span>
            <span className="text-2xl font-black italic text-purple-400">{aiRequestsToday} <span className="text-xs not-italic text-white/40">REQ</span></span>
          </div>
        </div>

        {message && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mb-8 p-4 rounded-2xl flex items-center gap-3 border ${
              message.type === 'success' 
                ? 'bg-green-500/10 border-green-500/20 text-green-400' 
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}
          >
            {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span className="text-sm font-medium">{message.text}</span>
          </motion.div>
        )}

        <div className="space-y-6">
          {/* Option 1: Daily Bonus */}
          <section className="group">
            <div className={`p-1 rounded-[2rem] transition-all duration-500 ${hasClaimedToday ? 'bg-white/5 opacity-50 cursor-not-allowed' : 'bg-gradient-to-br from-blue-500/20 to-purple-500/20 hover:from-blue-500/30 hover:to-purple-500/30'}`}>
              <div className="bg-[#0D0D0F] rounded-[1.8rem] p-8 flex flex-col sm:flex-row items-center gap-6">
                <div className="w-16 h-16 rounded-[1.4rem] bg-blue-500/10 flex items-center justify-center shrink-0">
                  <Gift className="w-8 h-8 text-blue-400" />
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <h3 className="text-lg font-bold mb-1">Bonus Harian</h3>
                  <p className="text-white/40 text-xs mb-4 uppercase tracking-widest font-black">Pertama klik dapat 5 poin</p>
                  <div className="flex flex-wrap justify-center sm:justify-start gap-2">
                    <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-bold uppercase">Setiap Hari</span>
                    <span className="px-3 py-1 rounded-full bg-white/5 text-white/40 text-[10px] font-bold uppercase">+5 Poin</span>
                  </div>
                </div>
                <button 
                  disabled={hasClaimedToday}
                  onClick={handleClaimDaily}
                  className={`px-8 py-3 rounded-2xl font-black italic uppercase tracking-widest text-xs transition-all ${
                    hasClaimedToday 
                    ? 'bg-white/5 text-white/20 cursor-not-allowed' 
                    : 'bg-blue-500 text-white hover:bg-blue-600 active:scale-95 shadow-[0_0_20px_rgba(59,130,246,0.3)]'
                  }`}
                >
                  {hasClaimedToday ? 'Selesai' : 'Ambil Sekarang'}
                </button>
              </div>
            </div>
          </section>

          {/* Option 2: Secret Code */}
          <section className="group">
            <div className="p-1 rounded-[2rem] bg-white/[0.03] border border-white/5 transition-all duration-500 hover:border-white/10">
              <div className="bg-[#0D0D0F] rounded-[1.8rem] p-8">
                <div className="flex flex-col sm:flex-row items-center gap-6 mb-8 text-center sm:text-left">
                  <div className="w-16 h-16 rounded-[1.4rem] bg-purple-500/10 flex items-center justify-center shrink-0">
                    <Key className="w-8 h-8 text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold mb-1">Kode Rahasia</h3>
                    <p className="text-white/40 text-xs uppercase tracking-widest font-black">Tukar kode untuk 12 poin</p>
                  </div>
                  <div className="px-4 py-2 rounded-xl bg-purple-500/5 border border-purple-500/10 text-purple-400 text-[10px] font-bold uppercase tracking-tighter">
                    Bonus +12 Poin
                  </div>
                </div>

                <form onSubmit={handleRedeem} className="flex gap-2">
                  <input 
                    type="text" 
                    value={secretCode}
                    onChange={(e) => setSecretCode(e.target.value)}
                    placeholder="Masukan kode rahasia..."
                    className="flex-1 bg-white/[0.02] border border-white/5 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-purple-500/40 transition-colors"
                  />
                  <button 
                    type="submit"
                    className="px-8 py-4 bg-white text-black hover:bg-white/90 active:scale-95 transition-all rounded-2xl font-black italic uppercase tracking-widest text-xs"
                  >
                    Tukar
                  </button>
                </form>
              </div>
            </div>
          </section>

          {/* Tips / Info */}
          <div className="p-8 rounded-[2rem] bg-gradient-to-br from-yellow-500/5 to-transparent border border-yellow-500/10">
            <div className="flex items-start gap-4">
              <Sparkles className="w-5 h-5 text-yellow-500 shrink-0 mt-1" />
              <div>
                <h4 className="text-sm font-bold text-yellow-500 mb-2 uppercase tracking-widest">Informasi Penting</h4>
                <p className="text-white/40 text-xs leading-relaxed">
                  Poin digunakan untuk setiap interaksi dengan asisten AI. Pastikan Anda memanfaatkan bonus harian untuk menjaga pengerjaan proyek tetap lancar. Kode rahasia dapat ditemukan di komunitas atau melalui acara khusus.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
