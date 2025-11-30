'use client';

import Logo from '@/components/ui/Logo';
import Link from 'next/link';

export default function RiskDisclaimer() {
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
          Avertissement sur les Risques
        </h1>
        
        <div className="prose prose-invert max-w-none space-y-6 text-gray-300">
          <div className="p-6 bg-red-500/10 border-2 border-red-500/50 rounded-lg">
            <p className="text-lg font-bold text-red-400 mb-4">
              ⚠️ AVERTISSEMENT IMPORTANT
            </p>
            <p>
              L'utilisation de SOLcloser et des cryptomonnaies comporte des risques significatifs. 
              Veuillez lire attentivement cet avertissement avant d'utiliser le Service.
            </p>
          </div>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">1. Absence de Conseil Financier</h2>
            <p>
              <strong>SOLcloser ne fournit aucun conseil en investissement, conseil financier, 
              conseil juridique ou conseil fiscal.</strong>
            </p>
            <p className="mt-4">
              Les informations fournies sur ce site sont à titre informatif uniquement et ne constituent 
              en aucun cas une recommandation d'achat, de vente ou de détention de cryptomonnaies.
            </p>
            <p className="mt-4">
              Vous êtes seul responsable de vos décisions financières. Nous vous recommandons vivement 
              de consulter des conseillers professionnels (financiers, juridiques, fiscaux) avant toute 
              décision d'investissement.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">2. Risques liés aux Cryptomonnaies</h2>

            <h3 className="text-xl font-bold text-neon-purple mt-6 mb-3">2.1 Volatilité Extrême</h3>
            <p>
              Les cryptomonnaies, dont le SOL (Solana), sont soumises à une volatilité extrême. 
              Leur valeur peut fluctuer de manière significative en très peu de temps, entraînant 
              des pertes financières importantes.
            </p>

            <h3 className="text-xl font-bold text-neon-purple mt-6 mb-3">2.2 Risque de Perte Totale</h3>
            <p>
              Vous pouvez perdre la totalité de votre investissement. N'investissez que des sommes 
              que vous pouvez vous permettre de perdre.
            </p>

            <h3 className="text-xl font-bold text-neon-purple mt-6 mb-3">2.3 Absence de Garantie</h3>
            <p>
              Contrairement aux dépôts bancaires traditionnels, les cryptomonnaies ne sont pas garanties 
              par un système d'assurance des dépôts ou par une autorité gouvernementale.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">3. Risques Technologiques</h2>

            <h3 className="text-xl font-bold text-neon-purple mt-6 mb-3">3.1 Irréversibilité des Transactions</h3>
            <p>
              <strong>Les transactions blockchain sont irréversibles.</strong> Une fois confirmée, 
              une transaction ne peut être annulée, modifiée ou remboursée. Vérifiez attentivement 
              toutes les informations avant de confirmer une transaction.
            </p>

            <h3 className="text-xl font-bold text-neon-purple mt-6 mb-3">3.2 Perte de Clés Privées</h3>
            <p>
              La perte de vos clés privées ou de votre phrase de récupération entraîne la perte 
              définitive et irrécupérable de vos fonds. SOLcloser n'a jamais accès à vos clés privées 
              et ne peut pas récupérer vos fonds en cas de perte.
            </p>

            <h3 className="text-xl font-bold text-neon-purple mt-6 mb-3">3.3 Vulnérabilités des Smart Contracts</h3>
            <p>
              Les smart contracts peuvent contenir des bugs ou des vulnérabilités de sécurité non 
              détectés, pouvant entraîner la perte de fonds.
            </p>

            <h3 className="text-xl font-bold text-neon-purple mt-6 mb-3">3.4 Risques de Réseau</h3>
            <p>
              Le réseau Solana peut connaître des périodes de congestion, des interruptions de service 
              ou des dysfonctionnements techniques affectant le bon déroulement des transactions.
            </p>

            <h3 className="text-xl font-bold text-neon-purple mt-6 mb-3">3.5 Attaques et Piratage</h3>
            <p>
              Les portefeuilles, exchanges et services blockchain peuvent faire l'objet d'attaques 
              informatiques, de piratages ou de tentatives de phishing.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">4. Risques Réglementaires et Juridiques</h2>

            <h3 className="text-xl font-bold text-neon-purple mt-6 mb-3">4.1 Incertitude Réglementaire</h3>
            <p>
              La réglementation des cryptomonnaies est en constante évolution et varie selon les 
              juridictions. De nouvelles lois ou régulations peuvent affecter la légalité, la fiscalité 
              ou l'utilisation des cryptomonnaies.
            </p>

            <h3 className="text-xl font-bold text-neon-purple mt-6 mb-3">4.2 Obligations Fiscales</h3>
            <p>
              En France, les gains en cryptomonnaies sont imposables. Vous êtes responsable de déclarer 
              vos gains et de vous conformer à toutes les obligations fiscales applicables.
            </p>
            <p className="mt-2">
              Le non-respect des obligations fiscales peut entraîner des sanctions, amendes ou poursuites.
            </p>

            <h3 className="text-xl font-bold text-neon-purple mt-6 mb-3">4.3 Lutte Anti-Blanchiment</h3>
            <p>
              L'utilisation de cryptomonnaies à des fins illégales (blanchiment d'argent, financement 
              du terrorisme, etc.) est strictement interdite et passible de sanctions pénales.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">5. Risques Spécifiques à SOLcloser</h2>

            <h3 className="text-xl font-bold text-neon-purple mt-6 mb-3">5.1 Service "Tel Quel"</h3>
            <p>
              SOLcloser est fourni "en l'état" sans garantie d'aucune sorte. Nous ne garantissons pas 
              que le Service sera exempt d'erreurs, de bugs ou de dysfonctionnements.
            </p>

            <h3 className="text-xl font-bold text-neon-purple mt-6 mb-3">5.2 Disponibilité du Service</h3>
            <p>
              Le Service peut être interrompu, suspendu ou modifié à tout moment, avec ou sans préavis.
            </p>

            <h3 className="text-xl font-bold text-neon-purple mt-6 mb-3">5.3 Frais de Transaction</h3>
            <p>
              Outre les frais de service de SOLcloser (15%), des frais de réseau Solana s'appliquent 
              à chaque transaction. Ces frais varient selon la congestion du réseau.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">6. Limitation de Responsabilité</h2>
            <p>
              Dans les limites autorisées par la loi :
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>SOLcloser ne sera pas responsable des pertes financières</li>
              <li>SOLcloser ne sera pas responsable des erreurs de transaction</li>
              <li>SOLcloser ne sera pas responsable des dysfonctionnements du réseau Solana</li>
              <li>SOLcloser ne sera pas responsable des actions de tiers (hackers, etc.)</li>
              <li>SOLcloser ne sera pas responsable des changements réglementaires</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">7. Recommandations de Sécurité</h2>
            <p>Pour minimiser les risques, nous vous recommandons de :</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>✅ Sauvegarder votre phrase de récupération dans un endroit sûr</li>
              <li>✅ Ne jamais partager vos clés privées</li>
              <li>✅ Vérifier attentivement chaque transaction avant de la signer</li>
              <li>✅ Utiliser un portefeuille hardware pour les montants importants</li>
              <li>✅ Activer l'authentification à deux facteurs (2FA) quand disponible</li>
              <li>✅ Se méfier des tentatives de phishing</li>
              <li>✅ Ne pas investir plus que ce que vous pouvez vous permettre de perdre</li>
              <li>✅ Vous informer continuellement sur la sécurité blockchain</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">8. Acceptation des Risques</h2>
            <div className="p-6 bg-yellow-500/10 border-2 border-yellow-500/50 rounded-lg">
              <p className="font-bold text-yellow-400 mb-4">
                EN UTILISANT SOLCLOSER, VOUS RECONNAISSEZ :
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Avoir lu et compris cet avertissement sur les risques</li>
                <li>Être conscient des risques inhérents aux cryptomonnaies</li>
                <li>Accepter l'entière responsabilité de vos décisions</li>
                <li>Comprendre que SOLcloser ne fournit aucun conseil financier</li>
                <li>Être seul responsable de la sécurité de votre portefeuille</li>
                <li>Accepter que les transactions sont irréversibles</li>
                <li>Vous conformer à toutes les lois et régulations applicables</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">9. Contact</h2>
            <p>
              Pour toute question concernant cet avertissement :
            </p>
            <div className="p-4 bg-dark-card border border-dark-border rounded-lg mt-4">
              <p>
                <strong>Email :</strong> [À COMPLÉTER]<br />
                <strong>GitHub :</strong> <a href="https://github.com/SolFinder-project/sol-closer" target="_blank" rel="noopener noreferrer" className="text-neon-pink hover:underline">
                  github.com/SolFinder-project/sol-closer
                </a>
              </p>
            </div>
          </section>
        </div>

        <div className="mt-12 flex gap-4">
          <Link href="/" className="btn-cyber inline-block">
            ← Retour à l'accueil
          </Link>
          <Link href="/legal/en/risks" className="px-6 py-3 rounded-lg border-2 border-neon-purple/30 text-neon-purple hover:bg-neon-purple/10 transition-all duration-300">
            English version →
          </Link>
        </div>
      </div>
    </main>
  );
}
