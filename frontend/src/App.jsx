import { Routes, Route } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import Dashboard from './pages/Dashboard';
import Onboarding from './pages/Onboarding';
import CreateAgent from './pages/CreateAgent';
import PolicyBuilder from './pages/PolicyBuilder';
import ExecuteAction from './pages/ExecuteAction';
import AgentProfile from './pages/AgentProfile';
import SquadChallenge from './pages/Fantasy';
import Predictions from './pages/Predictions';
import Marketplace from './pages/Marketplace';
import Learn from './pages/Learn';
import FanProfile from './pages/FanProfile';
import AgentsHub from './pages/AgentsHub';

// Admin portal
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminFranchises from './pages/admin/AdminFranchises';
import AdminMatches from './pages/admin/AdminMatches';
import AdminPlayers from './pages/admin/AdminPlayers';
import AdminChallenges from './pages/admin/AdminChallenges';
import AdminUsers from './pages/admin/AdminUsers';
import AdminOracle from './pages/admin/AdminOracle';
import AdminSettlement from './pages/admin/AdminSettlement';

// Franchise portal
import FranchiseLayout from './pages/franchise/FranchiseLayout';
import FranchiseDashboard from './pages/franchise/FranchiseDashboard';
import FranchiseMatches from './pages/franchise/FranchiseMatches';
import FranchisePlayers from './pages/franchise/FranchisePlayers';
import FranchiseChallenges from './pages/franchise/FranchiseChallenges';
import FranchiseLive from './pages/franchise/FranchiseLive';
import FranchiseContests from './pages/franchise/FranchiseContests';
import FranchiseAnalytics from './pages/franchise/FranchiseAnalytics';

export default function App() {
  return (
    <div className="app-bg min-h-screen flex flex-col">
      <div className="noise-overlay" />
      <Navbar />
      <main className="relative z-10 flex-1 max-w-7xl mx-auto w-full px-4 lg:px-6 py-8 pb-28 md:pb-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/welcome" element={<Onboarding />} />
          <Route path="/agents" element={<AgentsHub />} />
          <Route path="/create-agent" element={<CreateAgent />} />
          <Route path="/policy/:agentId" element={<PolicyBuilder />} />
          <Route path="/execute/:agentId" element={<ExecuteAction />} />
          <Route path="/agent/:agentId" element={<AgentProfile />} />
          <Route path="/squad-challenge" element={<SquadChallenge />} />
          <Route path="/predict" element={<Predictions />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/learn" element={<Learn />} />
          <Route path="/fan/:address" element={<FanProfile />} />

          {/* Admin portal */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="franchises" element={<AdminFranchises />} />
            <Route path="matches" element={<AdminMatches />} />
            <Route path="players" element={<AdminPlayers />} />
            <Route path="challenges" element={<AdminChallenges />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="oracle" element={<AdminOracle />} />
            <Route path="settlement" element={<AdminSettlement />} />
          </Route>

          {/* Franchise portal */}
          <Route path="/franchise" element={<FranchiseLayout />}>
            <Route index element={<FranchiseDashboard />} />
            <Route path="matches" element={<FranchiseMatches />} />
            <Route path="players" element={<FranchisePlayers />} />
            <Route path="challenges" element={<FranchiseChallenges />} />
            <Route path="live" element={<FranchiseLive />} />
            <Route path="contests" element={<FranchiseContests />} />
            <Route path="analytics" element={<FranchiseAnalytics />} />
          </Route>
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
