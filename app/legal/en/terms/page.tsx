'use client';

import Logo from '@/components/ui/Logo';
import Link from 'next/link';

export default function TermsOfService() {
  return (
    <main className="min-h-screen bg-dark-bg">
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-dark-bg/80 border-b border-dark-border">
        <div className="container mx-auto px-4 py-4">
          <Link href="/">
            <Logo />
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-neon-purple to-neon-pink">
          Terms of Service
        </h1>
        
        <div className="prose prose-invert max-w-none space-y-6 text-gray-300">
          <p className="text-sm text-gray-500">Last Updated: [TO BE COMPLETED]</p>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">1. Acceptance of Terms</h2>
            <p>
              By accessing and using SOLcloser ("the Service"), you accept and agree to be bound by the terms 
              and provisions of this agreement. If you do not agree to these Terms of Service, please do not 
              use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">2. Description of Service</h2>
            <p>
              SOLcloser is a decentralized application (dApp) that allows users to identify and close unused 
              SPL token accounts on the Solana blockchain to reclaim rent deposits (SOL).
            </p>
            <p>The Service provides:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Wallet scanning to identify empty token accounts</li>
              <li>Facilitation of account closing via blockchain transactions</li>
              <li>A service fee of 20% on reclaimed SOL</li>
              <li>A referral program offering 10% rewards</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">3. User Responsibilities</h2>
            <p>You agree to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Maintain the security of your wallet and private keys</li>
              <li>Verify all transactions before signing</li>
              <li>Use the Service only for lawful purposes</li>
              <li>Not attempt to manipulate, exploit, or abuse the Service</li>
              <li>Understand that all blockchain transactions are final and irreversible</li>
              <li>Comply with all applicable laws and regulations in your jurisdiction</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">4. Fees and Payments</h2>
            
            <h3 className="text-xl font-bold text-neon-purple mt-6 mb-3">4.1 Service Fee</h3>
            <p>
              SOLcloser charges a service fee of 20% on all SOL reclaimed through the closing of token accounts. 
              This fee is automatically deducted during the transaction process.
            </p>
            <p>
              The exact fee amount is clearly displayed before you confirm any transaction. You will receive 
              approximately 80% of the reclaimed SOL, minus Solana network fees.
            </p>

            <h3 className="text-xl font-bold text-neon-purple mt-6 mb-3">4.2 Referral Program</h3>
            <p>
              Users can participate in the referral program by sharing their unique referral link. 
              Referrers receive 10% of the SOL reclaimed by users they refer, deducted from the service fee.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">5. Disclaimers and Limitations of Liability</h2>
            
            <h3 className="text-xl font-bold text-neon-purple mt-6 mb-3">5.1 "AS IS" Service</h3>
            <p>
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, 
              EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, 
              FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.
            </p>

            <h3 className="text-xl font-bold text-neon-purple mt-6 mb-3">5.2 No Financial Advice</h3>
            <p>
              SOLcloser does not provide financial, investment, legal, or tax advice. All decisions 
              regarding the use of the Service are your sole responsibility. You should consult with 
              professional advisors before making any financial decisions.
            </p>

            <h3 className="text-xl font-bold text-neon-purple mt-6 mb-3">5.3 Blockchain Risks</h3>
            <p>
              You acknowledge and accept the risks associated with blockchain technology, including but not limited to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Smart contract vulnerabilities</li>
              <li>Network congestion and failed transactions</li>
              <li>Loss of private keys resulting in permanent loss of funds</li>
              <li>Regulatory uncertainty</li>
              <li>Irreversible transactions</li>
              <li>Cryptocurrency volatility</li>
            </ul>

            <h3 className="text-xl font-bold text-neon-purple mt-6 mb-3">5.4 Limitation of Liability</h3>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, SOLCLOSER AND ITS OPERATORS SHALL NOT BE LIABLE 
              FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS 
              OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, 
              USE, GOODWILL, OR OTHER INTANGIBLE LOSSES RESULTING FROM:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Your use or inability to use the Service</li>
              <li>Any unauthorized access to or use of your wallet</li>
              <li>Any interruption or cessation of the Service</li>
              <li>Any bugs, viruses, or other harmful code</li>
              <li>Any errors or omissions in any content</li>
              <li>Any loss or damage of any kind incurred as a result of your use of the Service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">6. Your Wallet and Security</h2>
            <p>
              You are solely responsible for:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Safeguarding your wallet credentials and private keys</li>
              <li>All transactions initiated from your wallet</li>
              <li>Verifying transaction details before signing</li>
              <li>Understanding Solana blockchain mechanics</li>
              <li>Maintaining secure backups of your recovery phrase</li>
            </ul>
            <p className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <strong>Critical:</strong> SOLcloser never has access to your private keys and cannot 
              reverse transactions or recover lost funds.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">7. Prohibited Uses</h2>
            <p>You may not use the Service to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Violate any applicable laws or regulations</li>
              <li>Infringe upon intellectual property rights</li>
              <li>Transmit malicious code or viruses</li>
              <li>Attempt to gain unauthorized access to the Service</li>
              <li>Engage in any form of market manipulation</li>
              <li>Use the Service for money laundering or terrorist financing</li>
              <li>Impersonate any person or entity</li>
              <li>Interfere with or disrupt the Service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">8. Intellectual Property</h2>
            <p>
              The Service and its original content, features, and functionality are owned by SOLcloser 
              and are protected by international copyright, trademark, and other intellectual property laws.
            </p>
            <p className="mt-4">
              The source code is licensed under Creative Commons Attribution-NonCommercial-ShareAlike 4.0 
              International License (CC BY-NC-SA 4.0). Commercial use requires explicit written permission.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">9. Tax Obligations</h2>
            <p>
              You are solely responsible for determining what taxes, if any, apply to your use of the Service 
              and any gains you realize. SOLcloser is not responsible for determining, collecting, reporting, 
              or remitting taxes arising from your use of the Service.
            </p>
            <p className="mt-4">
              Cryptocurrency transactions may be subject to taxation in your jurisdiction. We strongly recommend 
              consulting with a tax professional regarding your specific situation.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">10. Anti-Money Laundering</h2>
            <p>
              SOLcloser is committed to combating money laundering and terrorist financing. We reserve the 
              right to suspend or refuse access to the Service in case of suspected fraudulent or illegal activity.
            </p>
            <p className="mt-4">
              Users agree not to use the Service for money laundering, terrorist financing, or any other illegal purposes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">11. Termination</h2>
            <p>
              We reserve the right to terminate or suspend access to the Service immediately, without 
              prior notice or liability, for any reason whatsoever, including without limitation if you 
              breach these Terms.
            </p>
            <p className="mt-4">
              Upon termination, your right to use the Service will immediately cease. All provisions of 
              the Terms which by their nature should survive termination shall survive, including ownership 
              provisions, warranty disclaimers, and limitations of liability.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">12. Changes to Terms</h2>
            <p>
              We reserve the right to modify or replace these Terms at any time at our sole discretion. 
              We will provide notice of any material changes by posting the new Terms on this page and 
              updating the "Last Updated" date.
            </p>
            <p className="mt-4">
              Your continued use of the Service after any changes constitutes acceptance of the new Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">13. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of France, 
              without regard to its conflict of law provisions.
            </p>
            <p className="mt-4">
              Any disputes arising from these Terms or your use of the Service shall be subject to the 
              exclusive jurisdiction of the courts of France.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">14. Severability</h2>
            <p>
              If any provision of these Terms is found to be unenforceable or invalid, that provision 
              will be limited or eliminated to the minimum extent necessary so that these Terms will 
              otherwise remain in full force and effect.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">15. Entire Agreement</h2>
            <p>
              These Terms constitute the entire agreement between you and SOLcloser regarding the use 
              of the Service, superseding any prior agreements between you and SOLcloser relating to your 
              use of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">16. Contact Information</h2>
            <p>
              For questions about these Terms, please contact us at:
            </p>
            <div className="p-4 bg-dark-card border border-dark-border rounded-lg mt-4">
              <p>
                <strong>Email:</strong> [TO BE COMPLETED]<br />
                <strong>Address:</strong> [TO BE COMPLETED]<br />
                <strong>GitHub:</strong> <a href="https://github.com/SolFinder-project/sol-closer" className="text-neon-pink hover:underline" target="_blank" rel="noopener noreferrer">
                  https://github.com/SolFinder-project/sol-closer
                </a>
              </p>
            </div>
          </section>

          <div className="mt-12 pt-8 border-t border-dark-border">
            <p className="text-sm text-gray-500">
              By using SOLcloser, you acknowledge that you have read, understood, and agree to be bound 
              by these Terms of Service.
            </p>
          </div>
        </div>

        <div className="mt-12 flex gap-4">
          <Link href="/" className="btn-cyber inline-block">
            ← Back to Home
          </Link>
          <Link href="/legal/fr/terms" className="px-6 py-3 rounded-lg border-2 border-neon-purple/30 text-neon-purple hover:bg-neon-purple/10 transition-all duration-300">
            Version française →
          </Link>
        </div>
      </div>
    </main>
  );
}
