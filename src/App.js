import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

// 配置信息
const DISTRIBUTOR_ADDRESS = "0x60Bc65F3114E08EbB6B3418a082B2274b1141D21";
const DISTRIBUTOR_ABI = [
  "function batchTransferToken(address _tokenAddress, address[] _recipients, uint256[] _amounts) external"
];
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) public returns (bool)",
  "function allowance(address owner, address spender) public view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)"
];

function App() {
  const [account, setAccount] = useState('');
  const [tokenAddr, setTokenAddr] = useState('');
  const [inputData, setInputData] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0); // 0: 初始, 1: 授权中, 2: 分发中
  const [status, setStatus] = useState({ type: '', msg: '' });

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accs) => setAccount(accs[0] || ''));
      window.ethereum.on('chainChanged', () => window.location.reload());
    }
  }, []);

  const showStatus = (type, msg) => {
    setStatus({ type, msg });
    if (type !== 'info') setTimeout(() => setStatus({ type: '', msg: '' }), 8000);
  };

  async function connectWallet() {
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      setAccount(accounts[0]);
    } catch (err) {
      showStatus('error', 'Wallet connection failed');
    }
  }

  async function handleAction() {
    if (!account) return connectWallet();
    if (!ethers.isAddress(tokenAddr) || !inputData) return showStatus('error', 'Please check Token Address and List');

    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();
      if (network.chainId !== 56n) return showStatus('error', 'Please switch to BSC Mainnet');

      const signer = await provider.getSigner();
      const tokenContract = new ethers.Contract(tokenAddr, ERC20_ABI, signer);
      const distributor = new ethers.Contract(DISTRIBUTOR_ADDRESS, DISTRIBUTOR_ABI, signer);

      // 1. 解析数据
      const lines = inputData.split('\n').filter(l => l.includes(','));
      const recipients = [];
      const amounts = [];
      let totalAmount = 0n;

      // 自动获取代币精度（动态适配 USDT 或 其它代币）
      const decimals = await tokenContract.decimals();

      for (let line of lines) {
        const [addr, val] = line.split(',');
        if (ethers.isAddress(addr.trim())) {
          const parsedAmount = ethers.parseUnits(val.trim(), decimals);
          recipients.push(addr.trim());
          amounts.push(parsedAmount);
          totalAmount += parsedAmount;
        }
      }

      // 2. 检查并执行授权 (Approve)
      setStep(1);
      const allowance = await tokenContract.allowance(account, DISTRIBUTOR_ADDRESS);
      if (allowance < totalAmount) {
        showStatus('info', 'Step 1: Approving token usage...');
        const approveTx = await tokenContract.approve(DISTRIBUTOR_ADDRESS, ethers.MaxUint256);
        await approveTx.wait();
        showStatus('info', 'Approval confirmed! Moving to distribution...');
      }

      // 3. 执行分发 (Distribute)
      setStep(2);
      showStatus('info', 'Step 2: Distributing tokens to recipients...');
      const tx = await distributor.batchTransferToken(tokenAddr, recipients, amounts);
      
      showStatus('info', `Transaction sent: ${tx.hash.substring(0, 16)}...`);
      await tx.wait();
      
      showStatus('success', `🎉 Successfully sent to ${recipients.length} addresses!`);
      setInputData('');
      setStep(0);
    } catch (err) {
      console.error(err);
      showStatus('error', err.reason || err.message || 'Transaction failed');
      setStep(0);
    } finally {
      setLoading(false);
    }
  }

  // UI Styles
  const styles = {
    wrapper: { minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#f8fafc', padding: '60px 20px', fontFamily: '"Inter", sans-serif' },
    mainCard: { maxWidth: '540px', margin: '0 auto', background: 'rgba(30, 41, 59, 0.7)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', padding: '40px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' },
    inputGroup: { marginBottom: '24px' },
    label: { display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#94a3b8' },
    input: { width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: '12px', padding: '14px', color: '#fff', fontSize: '15px', boxSizing: 'border-box', transition: 'all 0.2s' },
    btn: { width: '100%', background: 'linear-gradient(90deg, #38bdf8 0%, #818cf8 100%)', border: 'none', borderRadius: '12px', padding: '16px', color: '#fff', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', transition: 'transform 0.2s', boxShadow: '0 4px 14px 0 rgba(56, 189, 248, 0.39)' },
    statusBadge: { padding: '12px', borderRadius: '12px', marginBottom: '24px', fontSize: '14px', textAlign: 'center', animation: 'fadeIn 0.3s ease' }
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.mainCard}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: '800', margin: '0 0 8px 0', background: 'linear-gradient(to right, #38bdf8, #818cf8)', WebScit: 'text', WebkitBackgroundClip: 'text', color: 'transparent' }}>
            Batch Sender Pro
          </h1>
          <p style={{ color: '#64748b', fontSize: '14px' }}>Fast. Secure. Multi-transfer.</p>
        </div>

        {status.msg && (
          <div style={{ ...styles.statusBadge, background: status.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)', color: status.type === 'error' ? '#f87171' : '#4ade80', border: `1px solid ${status.type === 'error' ? '#7f1d1d' : '#14532d'}` }}>
            {status.msg}
          </div>
        )}

        <div style={styles.inputGroup}>
          <label style={styles.label}>Token Address</label>
          <input 
            style={styles.input} 
            placeholder="0x..." 
            value={tokenAddr} 
            onChange={e => setTokenAddr(e.target.value)} 
          />
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>Recipients & Amounts (Address,Amount)</label>
          <textarea 
            style={{ ...styles.input, height: '140px', resize: 'none' }} 
            placeholder="0x123...,10.5&#10;0x456...,20" 
            value={inputData} 
            onChange={e => setInputData(e.target.value)} 
          />
        </div>

        <button 
          style={{ ...styles.btn, opacity: loading ? 0.7 : 1, transform: loading ? 'scale(0.98)' : 'scale(1)' }} 
          onClick={handleAction} 
          disabled={loading}
        >
          {!account ? "Connect Wallet" : loading ? `Step ${step}: Processing...` : "Run Batch Distribution"}
        </button>

        <div style={{ marginTop: '24px', background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '12px', fontSize: '12px', color: '#94a3b8', lineHeight: '1.6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span>Contract Address:</span>
            <span style={{ color: '#38bdf8' }}>{DISTRIBUTOR_ADDRESS.slice(0,6)}...{DISTRIBUTOR_ADDRESS.slice(-4)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Network:</span>
            <span style={{ color: '#fcd535' }}>BSC Mainnet</span>
          </div>
          <p style={{ marginTop: '8px', borderTop: '1px solid #334155', paddingTop: '8px' }}>
            Note: First-time use requires an <strong>Approval</strong> transaction to allow the contract to send tokens on your behalf.
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;