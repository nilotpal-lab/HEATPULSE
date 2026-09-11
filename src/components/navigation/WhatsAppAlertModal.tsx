'use client';

/**
 * HeatPulse — WhatsApp Alert Registration & Instant QR Activation Modal
 * Standard: SIH26083 MoES / NCMRWF Master Build Specification
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  MessageSquare,
  Send,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ShieldCheck,
  Smartphone,
  Radio,
  Loader2,
  Sparkles,
  QrCode,
  ExternalLink,
  RotateCcw,
  Info,
  Check,
  RefreshCw,
} from 'lucide-react';
import { CITIES, CityId, CITY_LIST } from '@/types/gis';
import { useHeatPulseStore } from '@/lib/store';

interface WhatsAppAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCity?: CityId;
  defaultWardId?: string;
  defaultWardName?: string;
}

export default function WhatsAppAlertModal({
  isOpen,
  onClose,
  defaultCity = 'pune',
  defaultWardId,
  defaultWardName,
}: WhatsAppAlertModalProps) {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'register' | 'test' | 'bot'>('register');

  // Registration Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedCity, setSelectedCity] = useState<CityId>(defaultCity);
  const [selectedWard, setSelectedWard] = useState<string>(defaultWardId || '');
  const [language, setLanguage] = useState<'en' | 'hi' | 'mr'>('en');

  // Success & QR Activation State
  const [registeredUser, setRegisteredUser] = useState<{
    name: string;
    phone: string;
    wardName: string;
    city: string;
  } | null>(null);

  // Test Alert State
  const [testPhone, setTestPhone] = useState('');
  const [testLevel, setTestLevel] = useState<'critical' | 'warning' | 'watch'>('critical');

  // Loading & Feedback
  const [loading, setLoading] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [responseMsg, setResponseMsg] = useState<{ success: boolean; text: string } | null>(null);
  const [gatewayStatus, setGatewayStatus] = useState<{
    online: boolean;
    authenticated: boolean;
    user?: string;
    qr?: string;
  } | null>(null);

  // City Wards from Store
  const cachedCityData = useHeatPulseStore((s) => s.cachedCityData[selectedCity]);
  const wards = cachedCityData?.geoJson?.features || [];

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchStatus = () => {
    fetch('/api/whatsapp/status')
      .then((res) => res.json())
      .then((data) => {
        if (data.gateway) setGatewayStatus(data.gateway);
      })
      .catch(() => {});
  };

  const handleResetQr = async () => {
    setIsResetting(true);
    setResponseMsg(null);
    try {
      const res = await fetch('/api/whatsapp/reset', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setResponseMsg({ success: true, text: '🔄 QR signaling reset! Generating fresh WhatsApp pairing QR code...' });
        fetchStatus();
      } else {
        setResponseMsg({ success: false, text: data.error || 'Failed to reset QR signaling.' });
      }
    } catch (err: any) {
      setResponseMsg({ success: false, text: 'Reset error: ' + err.message });
    } finally {
      setIsResetting(false);
    }
  };

  // Poll status every 2.5s and trigger QR reset on open if unauthenticated and no QR code active
  useEffect(() => {
    if (isOpen) {
      fetchStatus();
      // Auto-reset QR signaling if gateway online but unauthenticated
      fetch('/api/whatsapp/status')
        .then((res) => res.json())
        .then((data) => {
          if (data.gateway?.online && !data.gateway?.authenticated && !data.gateway?.qr) {
            handleResetQr();
          }
        })
        .catch(() => {});

      const interval = setInterval(fetchStatus, 2500);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  // Sync selected city
  useEffect(() => {
    if (defaultCity) setSelectedCity(defaultCity);
  }, [defaultCity]);

  // Set default ward
  useEffect(() => {
    if (wards.length > 0 && !selectedWard) {
      const matched = defaultWardId
        ? wards.find((w: any) => w.properties.ward_id === defaultWardId || w.properties.ward_name === defaultWardName)
        : wards[0];
      if (matched) {
        setSelectedWard(matched.properties.ward_id || matched.properties.ward_name);
      }
    }
  }, [wards, defaultWardId, defaultWardName, selectedWard]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) return null;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/[^\d]/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      setResponseMsg({ success: false, text: 'Please enter a valid 10-digit WhatsApp phone number.' });
      return;
    }

    setLoading(true);
    setResponseMsg(null);

    const chosenWard = wards.find((w: any) => w.properties.ward_id === selectedWard || w.properties.ward_name === selectedWard);
    const wardName = chosenWard ? chosenWard.properties.ward_name : selectedWard || 'City Ward';
    const cityName = CITIES[selectedCity]?.name || selectedCity;

    try {
      const res = await fetch('/api/whatsapp/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name || 'Citizen',
          phone: cleanPhone,
          cityId: selectedCity,
          wardId: selectedWard || 'all',
          wardName,
          language,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setRegisteredUser({
          name: name || 'Citizen',
          phone: data.subscriber.phone,
          wardName,
          city: cityName,
        });
      } else {
        setResponseMsg({ success: false, text: data.error || 'Registration failed. Please check inputs.' });
      }
    } catch (err: any) {
      setResponseMsg({ success: false, text: 'Network error: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSendTestAlert = async (targetPhone?: string) => {
    const p = targetPhone || testPhone;
    const clean = p.replace(/[^\d]/g, '');
    if (!clean || clean.length < 10) {
      setResponseMsg({ success: false, text: 'Please enter a valid 10-digit phone number for the test demo.' });
      return;
    }

    setTestSending(true);
    setResponseMsg(null);

    try {
      const res = await fetch('/api/whatsapp/test-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: clean,
          city: CITIES[selectedCity]?.name || 'Pune',
          wardName: registeredUser?.wardName || 'Admin Ward 01 Aundh',
          level: testLevel,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setResponseMsg({
          success: true,
          text: `🚨 Live Heatwave Emergency alert dispatched to +${data.phone}! Check your handset.`,
        });
      } else {
        setResponseMsg({
          success: false,
          text: data.notice || data.error || 'Dispatched advisory.',
        });
      }
    } catch (err: any) {
      setResponseMsg({ success: false, text: 'Network request error: ' + err.message });
    } finally {
      setTestSending(false);
    }
  };

  // WhatsApp click-to-chat activation URL
  const botNumber = gatewayStatus?.user || '919876543210';
  const activationText = encodeURIComponent(
    `START HEATPULSE ALERTS for ${registeredUser?.wardName || 'Ward'} (${registeredUser?.city || 'City'})`
  );
  const waClickUrl = `https://wa.me/${botNumber}?text=${activationText}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
    waClickUrl
  )}&margin=8`;

  // Gateway Linking QR Code URL (for scanning to connect WhatsApp account)
  const gatewayQrUrl = gatewayStatus?.qr
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(gatewayStatus.qr)}&margin=8`
    : null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-zinc-950/75 backdrop-blur-md overflow-y-auto animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden flex flex-col my-auto transition-all transform animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-700 via-emerald-800 to-teal-900 text-white px-6 py-5 flex items-center justify-between border-b border-emerald-600/30">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/25 shadow-inner">
              <MessageSquare className="w-6 h-6 text-emerald-200 fill-emerald-200/20" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-lg text-white tracking-tight">HeatPulse WhatsApp Alerts</h2>
                <span className="text-[10px] uppercase font-extrabold tracking-wider px-2 py-0.5 bg-emerald-500/30 text-emerald-100 rounded-full border border-emerald-400/40">
                  {gatewayStatus?.authenticated ? '🟢 Live' : 'Free Signal'}
                </span>
              </div>
              <p className="text-xs text-emerald-100/90 mt-0.5">
                Hyperlocal Ward-Level Heatwave Warning System
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-2 rounded-xl text-emerald-200 hover:text-white hover:bg-white/15 transition-colors focus:outline-none focus:ring-2 focus:ring-white/40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        {!registeredUser && (
          <div className="grid grid-cols-3 border-b border-zinc-200 bg-zinc-50/90 p-1.5 gap-1.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setActiveTab('register');
                setResponseMsg(null);
              }}
              className={`py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'register'
                  ? 'bg-white text-emerald-800 shadow-xs border border-zinc-200/80 font-bold'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100/80'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
              <span>Register</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('test');
                setResponseMsg(null);
              }}
              className={`py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'test'
                  ? 'bg-white text-orange-900 shadow-xs border border-zinc-200/80 font-bold'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100/80'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-orange-600" />
              <span>Judge Demo</span>
              <span className="text-[9px] bg-orange-100 text-orange-800 px-1 py-0.2 rounded font-bold">LIVE</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('bot');
                setResponseMsg(null);
              }}
              className={`py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'bot'
                  ? 'bg-white text-blue-900 shadow-xs border border-zinc-200/80 font-bold'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100/80'
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-blue-600" />
              <span>Gateway QR</span>
              {gatewayStatus?.authenticated ? (
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              ) : (
                <span className="text-[9px] bg-amber-100 text-amber-800 px-1 py-0.2 rounded font-bold">SCAN</span>
              )}
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 space-y-4 max-h-[68vh] overflow-y-auto">
          {/* Notification Feedback */}
          {responseMsg && (
            <div
              className={`p-3.5 rounded-xl text-xs flex items-start gap-2.5 animate-in fade-in-50 ${
                responseMsg.success
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-950'
                  : 'bg-amber-50 border border-amber-200 text-amber-950'
              }`}
            >
              {responseMsg.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-bold">{responseMsg.success ? 'Success' : 'Notice'}</p>
                <p className="mt-0.5 text-zinc-700 leading-relaxed">{responseMsg.text}</p>
              </div>
            </div>
          )}

          {/* SCREEN: SUCCESS QR ACTIVATION SCREEN */}
          {registeredUser ? (
            <div className="space-y-4 text-center animate-in zoom-in-95 duration-200">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 text-emerald-900 rounded-full text-xs font-bold border border-emerald-300">
                <Check className="w-3.5 h-3.5 text-emerald-700" />
                <span>Step 2: Scan QR to Activate Alerts</span>
              </div>

              <div>
                <h3 className="text-base font-bold text-zinc-900">
                  Welcome, {registeredUser.name}!
                </h3>
                <p className="text-xs text-zinc-600 mt-0.5">
                  Registered for <strong>{registeredUser.wardName}</strong> ({registeredUser.city}) on +{registeredUser.phone}
                </p>
              </div>

              {/* QR Code Container */}
              <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200 inline-block shadow-inner">
                <div className="bg-white p-2.5 rounded-xl border border-zinc-300 shadow-sm inline-block">
                  <img
                    src={qrCodeUrl}
                    alt="Scan QR to Activate WhatsApp Alert"
                    width={180}
                    height={180}
                    className="mx-auto rounded-lg"
                  />
                </div>
                <p className="text-[11px] font-semibold text-zinc-600 mt-2.5 flex items-center justify-center gap-1.5">
                  <QrCode className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Scan with Phone Camera or WhatsApp</span>
                </p>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <a
                  href={waClickUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in WhatsApp</span>
                </a>

                <button
                  type="button"
                  disabled={testSending}
                  onClick={() => handleSendTestAlert(registeredUser.phone)}
                  className="py-2.5 px-4 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {testSending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending Test...</span>
                    </>
                  ) : (
                    <>
                      <Flame className="w-3.5 h-3.5" />
                      <span>Send Test Alert to Phone</span>
                    </>
                  )}
                </button>
              </div>

              <div className="pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => {
                    setRegisteredUser(null);
                    setPhone('');
                    setName('');
                    setResponseMsg(null);
                  }}
                  className="text-xs text-zinc-500 hover:text-zinc-800 flex items-center justify-center gap-1 mx-auto font-medium"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Register Another Number</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* TAB 1: REGISTRATION FORM */}
              {activeTab === 'register' && (
                <form onSubmit={handleRegister} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-800 mb-1">
                      Full Name <span className="text-zinc-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Ramesh Patil"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs text-zinc-900 bg-zinc-50/50 hover:bg-white rounded-xl border border-zinc-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-zinc-400 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-800 mb-1">
                      WhatsApp Phone Number <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      <div className="px-3.5 py-2.5 bg-zinc-100 border border-zinc-300 rounded-xl text-xs font-bold text-zinc-700 shrink-0 flex items-center gap-1.5">
                        <span>🇮🇳</span>
                        <span>+91</span>
                      </div>
                      <input
                        type="tel"
                        required
                        placeholder="9876543210"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-xs text-zinc-900 bg-zinc-50/50 hover:bg-white rounded-xl border border-zinc-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono placeholder:text-zinc-400 transition-colors"
                      />
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-1.5 flex items-center gap-1">
                      <Info className="w-3 h-3 text-zinc-400" />
                      <span>Instant automated early warnings when Heat Index exceeds 40°C in your ward.</span>
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-zinc-800 mb-1">City</label>
                      <select
                        value={selectedCity}
                        onChange={(e) => {
                          setSelectedCity(e.target.value as CityId);
                          setSelectedWard('');
                        }}
                        className="w-full px-3 py-2.5 text-xs text-zinc-900 bg-white rounded-xl border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-xs"
                      >
                        {CITY_LIST.map((city) => (
                          <option key={city.id} value={city.id} className="text-zinc-900">
                            {city.name} ({city.wardCount} Wards)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-800 mb-1">Municipal Ward</label>
                      <select
                        value={selectedWard}
                        onChange={(e) => setSelectedWard(e.target.value)}
                        className="w-full px-3 py-2.5 text-xs text-zinc-900 bg-white rounded-xl border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-xs"
                      >
                        {wards.length > 0 ? (
                          wards.map((w: any) => (
                            <option
                              key={w.properties.ward_id || w.properties.ward_name}
                              value={w.properties.ward_id || w.properties.ward_name}
                              className="text-zinc-900"
                            >
                              {w.properties.ward_name || `Ward ${w.properties.ward_id}`}
                            </option>
                          ))
                        ) : (
                          <option value="all" className="text-zinc-900">All Municipal Wards</option>
                        )}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-800 mb-1.5">Alert Language</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'en', label: 'English' },
                        { id: 'mr', label: 'मराठी (Marathi)' },
                        { id: 'hi', label: 'हिंदी (Hindi)' },
                      ].map((l) => (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => setLanguage(l.id as any)}
                          className={`py-2 px-2 text-xs rounded-xl border transition-all text-center ${
                            language === l.id
                              ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold shadow-xs'
                              : 'border-zinc-200 bg-zinc-50/50 text-zinc-600 hover:bg-zinc-100'
                          }`}
                        >
                          {l.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Generating Instant Activation QR...</span>
                        </>
                      ) : (
                        <>
                          <QrCode className="w-4 h-4" />
                          <span>Register & Get Activation QR Code</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 2: JUDGE LIVE DEMO TRIGGER */}
              {activeTab === 'test' && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendTestAlert();
                  }}
                  className="space-y-4"
                >
                  <div className="p-4 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl">
                    <div className="flex items-center gap-2 text-orange-950 font-bold text-xs">
                      <Sparkles className="w-4 h-4 text-orange-600 shrink-0" />
                      <span>Instant Live Hackathon Evaluation Demo</span>
                    </div>
                    <p className="text-[11px] text-orange-900/80 mt-1 leading-relaxed">
                      Enter any mobile number to trigger an immediate biometeorological heatwave advisory straight to WhatsApp.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-800 mb-1">
                      Recipient WhatsApp Number <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      <div className="px-3.5 py-2.5 bg-zinc-100 border border-zinc-300 rounded-xl text-xs font-bold text-zinc-700 shrink-0 flex items-center gap-1.5">
                        <span>🇮🇳</span>
                        <span>+91</span>
                      </div>
                      <input
                        type="tel"
                        required
                        placeholder="Enter 10-digit number..."
                        value={testPhone}
                        onChange={(e) => setTestPhone(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-xs text-zinc-900 bg-zinc-50/50 hover:bg-white rounded-xl border border-zinc-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-mono placeholder:text-zinc-400 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-800 mb-1.5">Simulated Advisory Severity</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'critical', label: 'Critical (43.8°C)', bg: 'border-red-500 bg-red-50 text-red-950' },
                        { id: 'warning', label: 'Warning (41.5°C)', bg: 'border-amber-500 bg-amber-50 text-amber-950' },
                        { id: 'watch', label: 'Watch (39.0°C)', bg: 'border-yellow-500 bg-yellow-50 text-yellow-950' },
                      ].map((lvl) => (
                        <button
                          key={lvl.id}
                          type="button"
                          onClick={() => setTestLevel(lvl.id as any)}
                          className={`p-2.5 text-xs rounded-xl border transition-all text-center ${
                            testLevel === lvl.id
                              ? `${lvl.bg} font-bold ring-2 ring-orange-500/30 shadow-xs`
                              : 'border-zinc-200 bg-zinc-50/50 text-zinc-600 hover:bg-zinc-100'
                          }`}
                        >
                          {lvl.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={testSending}
                      className="w-full py-3 px-4 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      {testSending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Dispatching to Handset...</span>
                        </>
                      ) : (
                        <>
                          <Flame className="w-4 h-4" />
                          <span>Send Real-Time WhatsApp Alert to My Phone</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 3: 2-WAY CHATBOT & LIVE GATEWAY PAIRING QR */}
              {activeTab === 'bot' && (
                <div className="space-y-4">
                  {/* Gateway QR Pairing Section if not yet authenticated */}
                  {!gatewayStatus?.authenticated && gatewayQrUrl ? (
                    <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-center space-y-2.5">
                      <div className="inline-flex items-center gap-1.5 text-emerald-900 font-bold text-xs">
                        <QrCode className="w-4 h-4 text-emerald-700" />
                        <span>Link Your WhatsApp Account Right Now</span>
                      </div>
                      <p className="text-[11px] text-emerald-800/80">
                        Scan this QR with <strong>WhatsApp &gt; Linked Devices</strong> to enable instant automated dispatch from your number:
                      </p>
                      <div className="bg-white p-2.5 rounded-xl border border-emerald-200 shadow-sm inline-block">
                        <img
                          src={gatewayQrUrl}
                          alt="Link WhatsApp Gateway"
                          width={180}
                          height={180}
                          className="mx-auto rounded-lg"
                        />
                      </div>
                      <p className="text-[10px] text-emerald-700 font-medium">
                        Auto-refreshes every few seconds. Once scanned, gateway links immediately!
                      </p>
                      <button
                        type="button"
                        disabled={isResetting}
                        onClick={handleResetQr}
                        className="mt-2 py-2 px-3 bg-white hover:bg-emerald-100/60 text-emerald-900 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-emerald-300 mx-auto shadow-xs disabled:opacity-50"
                      >
                        {isResetting ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-700" />
                            <span>Resetting QR Signaling...</span>
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Reset QR Signaling</span>
                          </>
                        )}
                      </button>
                    </div>
                  ) : gatewayStatus?.authenticated ? (
                    <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                        <div>
                          <p className="text-xs font-bold text-emerald-950">WhatsApp Gateway Live & Linked</p>
                          <p className="text-[10px] text-emerald-700">Account: +{gatewayStatus.user}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={isResetting}
                        onClick={handleResetQr}
                        className="text-[10px] bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors"
                        title="Unlink and reset QR signaling"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Reset QR</span>
                      </button>
                    </div>
                  ) : (
                    <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-center space-y-2">
                      <p className="text-xs font-bold text-amber-950">Gateway Offline or Generating QR...</p>
                      <p className="text-[11px] text-amber-800">
                        Start it with <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">npm run whatsapp</code>.
                      </p>
                      <button
                        type="button"
                        disabled={isResetting}
                        onClick={handleResetQr}
                        className="py-1.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1.5 shadow-xs"
                      >
                        {isResetting ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Resetting QR Signaling...</span>
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Reset QR Signaling</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl">
                    <div className="flex items-center gap-2 text-blue-950 font-bold text-xs">
                      <Radio className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>Two-Way Interactive WhatsApp Signal Bot</span>
                    </div>
                    <p className="text-[11px] text-blue-900/80 mt-1 leading-relaxed">
                      Citizens and emergency operators can query live heatwave indices directly over WhatsApp.
                    </p>
                  </div>

                  <div className="bg-zinc-900 text-zinc-100 rounded-xl p-4 font-mono text-xs space-y-2.5 shadow-inner">
                    <p className="text-zinc-400 text-[10px] uppercase font-bold tracking-wider">Try sending these messages:</p>
                    <div className="bg-zinc-800/90 p-2.5 rounded-lg border border-zinc-700/80">
                      <span className="text-emerald-400 font-bold">HEAT PUNE</span>
                      <p className="text-zinc-400 text-[11px] mt-0.5">Returns live thermal stress, WBGT, and affected wards.</p>
                    </div>
                    <div className="bg-zinc-800/90 p-2.5 rounded-lg border border-zinc-700/80">
                      <span className="text-emerald-400 font-bold">STATUS</span>
                      <p className="text-zinc-400 text-[11px] mt-0.5">Checks your registered ward heat risk score.</p>
                    </div>
                    <div className="bg-zinc-800/90 p-2.5 rounded-lg border border-zinc-700/80">
                      <span className="text-emerald-400 font-bold">COOLING</span>
                      <p className="text-zinc-400 text-[11px] mt-0.5">Hydration tips, ORS instructions, and emergency helpline.</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-zinc-50/90 border-t border-zinc-200/80 flex items-center justify-between text-[11px] text-zinc-500">
          <div className="flex items-center gap-1.5 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>SIH26083 MoES / NCMRWF Compliant</span>
          </div>
          <span className="font-semibold text-zinc-600">100% Free Open-Source Signal</span>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
