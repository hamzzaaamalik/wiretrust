import { useState } from 'react';
import { Zap, Trophy, Coins, Target, ShieldCheck, Rocket, ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';

const SECTIONS = [
  {
    title: 'What is WireFluid?',
    icon: <Zap size={18} />,
    iconClass: 'bg-primary/10 text-primary-light',
    content: `WireFluid is a next-generation blockchain platform built for speed, low cost, and real-world applications. It combines the security of Cosmos with the flexibility of the Ethereum Virtual Machine (EVM).

Think of it as the digital infrastructure powering everything on WireTrust. From joining squad challenges to earning prediction points to claiming NFT rewards, every action is recorded permanently and transparently. No one can alter the results after the fact.

WireFluid processes transactions in seconds and costs a fraction of a cent. You can participate in PSL contests, make match predictions and collect fan rewards without worrying about fees.`,
  },
  {
    title: 'What is Blockchain?',
    icon: <Trophy size={18} />,
    iconClass: 'bg-amber-500/10 text-amber-400',
    content: `Imagine a cricket scoreboard that can never be erased, altered or tampered with. Once the umpire records a run, it stays there forever. Every fan in the stadium can see the same score, and no one (not even the stadium owner) can change it after the fact.

That's essentially what a blockchain is: a shared, permanent record that everyone can verify but no one can cheat.

**Smart contracts** are like match rules written in code. Once the rules are set, they execute automatically. If the contract says "the highest-scoring squad wins the sponsor prize," that's exactly what happens. No umpire needed, no disputes, no delays.`,
  },
  {
    title: 'What is WIRE?',
    icon: <Coins size={18} />,
    iconClass: 'bg-secondary/10 text-secondary',
    content: `WIRE is the native currency of the WireFluid blockchain. You can think of it simply as "Credits."

On testnet (where we are now), WIRE is free. You receive 1,000 Credits when you sign up and can get more from the faucet anytime.

Squad challenges and predictions are completely free. You never spend Credits to play. Credits are only used when purchasing actual products (match tickets, fan experiences, collectibles, merch) through the NFT marketplace.`,
  },
  {
    title: 'Why This Matters for Fans',
    icon: <Target size={18} />,
    iconClass: 'bg-red-500/10 text-red-400',
    content: `**Trust**: Every transaction, every score, every prediction result is recorded on the blockchain. The rules can't be changed mid-game. You can verify everything yourself.

**Transparency**: Contest scoring is calculated by smart contracts, not by a company's internal algorithm. You can see the exact code that determines the winner.

**Ownership**: When you buy a ticket or collectible NFT, you truly own it. It's in your wallet, not in a company's database that could be shut down or changed.

**Anti-Scalping**: Ticket resale is capped at 110% of face value. No more paying 5x for a match ticket. The smart contract enforces this automatically.

**Reputation**: Your fan engagement builds a permanent on-chain record. Correct predictions, contest participation, and event attendance all contribute to your fan reputation.`,
  },
  {
    title: 'Is This Halal?',
    icon: <ShieldCheck size={18} />,
    iconClass: 'bg-emerald-500/10 text-emerald-400',
    content: `**Yes. WireTrust is designed from the ground up to be halal-compliant.**

**Squad Challenges: FREE to play.** There are no entry fees. You never risk your money on an outcome. Prize pools are funded by sponsors and franchises as promotional giveaways. You pick a squad based on skill, and if you win you receive a sponsored prize. This is a skill-based engagement tool, not gambling.

**Predictions: Points only.** You earn reputation points for correct predictions, not money. No staking, no wagering, no money changes hands based on match outcomes. This is opinion polling with gamification, like a quiz show where you earn badges.

**NFTs: Halal commerce.** When you buy a ticket, collectible or jersey NFT, you're purchasing a real product or service. This is standard commerce. You pay money, you receive something of value. No different from buying a physical ticket at the counter.

**No gambling. No betting. No speculation on match outcomes.** WireTrust is a fan engagement platform, not a betting platform. This makes it legally compliant in Pakistan and culturally appropriate across the Muslim world.`,
  },
  {
    title: 'Getting Started',
    icon: <Rocket size={18} />,
    iconClass: 'bg-orange-500/10 text-orange-400',
    content: `**Step 1: Create your wallet.** Sign in with Google or connect MetaMask. Either way, you'll receive 1,000 free Credits to explore.

**Step 2: Explore.** Browse upcoming matches, join a free squad challenge, make a prediction or check out the NFT marketplace.

**Step 3: Engage.** The more you participate, the more you earn. Prediction points, streak badges and fan reputation are all recorded permanently on the blockchain.`,
  },
];

const FAQ = [
  { q: 'Do I need to know about crypto?', a: 'No. Sign in with Google and WireTrust handles the rest. You never need to manage keys, gas fees or blockchain details.' },
  { q: 'Is my money at risk?', a: 'Squad challenges and predictions are always free. On testnet all WIRE is free from the faucet. On mainnet you only spend what you choose to buy (tickets, collectibles, merch).' },
  { q: 'Can I lose money on predictions?', a: 'No. Predictions are points-only. Correct predictions earn points and wrong ones simply reset your streak. No money changes hands.' },
  { q: 'What is a soulbound badge?', a: 'A badge NFT permanently tied to your wallet that proves an on-chain achievement. It cannot be sold or transferred. Examples: "5x Prediction Streak" or "Contest Winner".' },
  { q: 'How are squad challenge prizes funded?', a: 'Prize pools are funded by sponsors and franchise partners. Fans never pay an entry fee. This keeps the platform halal-compliant and legally defensible.' },
  { q: 'Where can I get more WIRE?', a: 'On testnet, visit the WireFluid faucet (faucet.wirefluid.com) to receive free WIRE at any time.' },
];

function renderContent(text) {
  return text.split('**').map((part, j) =>
    j % 2 === 1
      ? <strong key={j} className="text-zinc-100 font-medium">{part}</strong>
      : <span key={j}>{part}</span>
  );
}

export default function Learn() {
  const [openFaq, setOpenFaq] = useState(null);

  return (
    <div className="space-y-5 max-w-3xl mx-auto animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="page-title">Learn</h1>
        <p className="text-zinc-500 text-sm mt-1.5">
          Everything you need to know about WireTrust and blockchain fan engagement
        </p>
      </div>

      {/* Content Sections */}
      <div className="space-y-3">
        {SECTIONS.map((section, i) => (
          <div
            key={i}
            className="card animate-fade-in-up"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${section.iconClass}`}>
                {section.icon}
              </div>
              <h2 className="section-title text-base">{section.title}</h2>
            </div>

            <div className="card-surface">
              <p className="text-zinc-400 text-sm leading-relaxed whitespace-pre-line">
                {renderContent(section.content)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* FAQ Section */}
      <div
        className="card animate-fade-in-up"
        style={{ animationDelay: `${SECTIONS.length * 60}ms` }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-primary/10 text-primary-light">
            <HelpCircle size={18} />
          </div>
          <h2 className="section-title text-base">Frequently Asked Questions</h2>
        </div>

        <div className="space-y-0">
          {FAQ.map((item, i) => (
            <div key={i}>
              {i > 0 && <div className="divider" />}
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between py-3.5 text-left group"
              >
                <span className="text-sm font-medium text-zinc-300 group-hover:text-zinc-100 transition-colors">
                  {item.q}
                </span>
                <span className="ml-3 shrink-0 text-zinc-600">
                  {openFaq === i
                    ? <ChevronUp size={16} />
                    : <ChevronDown size={16} />
                  }
                </span>
              </button>
              {openFaq === i && (
                <div className="pb-3.5 -mt-1">
                  <div className="card-surface">
                    <p className="text-zinc-400 text-sm leading-relaxed">{item.a}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div
        className="text-center py-4 animate-fade-in-up"
        style={{ animationDelay: `${(SECTIONS.length + 1) * 60}ms` }}
      >
        <p className="text-2xs text-zinc-600">
          Powered by{' '}
          <a href="https://wirefluid.com" target="_blank" rel="noopener noreferrer" className="text-primary-light hover:text-primary transition-colors">
            WireFluid
          </a>
        </p>
        <p className="text-2xs text-zinc-600 mt-1">
          Need testnet WIRE? Visit the{' '}
          <a href="https://faucet.wirefluid.com" target="_blank" rel="noopener noreferrer" className="text-secondary hover:text-secondary/80 transition-colors">
            WireFluid Faucet
          </a>
        </p>
      </div>
    </div>
  );
}
