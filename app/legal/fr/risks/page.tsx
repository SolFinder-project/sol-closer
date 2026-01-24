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
              L'utilisation de SOLcloser et des cryptomonnaies comporte des risques importants. 
              Veuillez lire attentivement cet avertissement avant d'utiliser le Service.
            </p>
          </div>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">1. Aucun Conseil Financier</h2>
            <p>
              <strong>SOLcloser ne fournit aucun conseil financier, en investissement, juridique ou fiscal.</strong>
            </p>
            <p className="mt-4">
              Toutes les informations fournies sur ce site sont uniquement à titre informatif et ne 
              constituent pas une recommandation d'achat, de vente ou de détention de cryptomonnaies.
            </p>
            <p className="mt-4">
              Vous êtes seul responsable de vos décisions financières. Nous vous recommandons vivement 
              de consulter des conseillers professionnels (financiers, juridiques, fiscaux) avant de 
              prendre toute décision d'investissement.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">2. Risques liés aux Cryptomonnaies</h2>

            <h3 className="text-xl font-bold text-neon-purple mt-6 mb-3">2.1 Volatilité Extrême</h3>
            <p>
              Les cryptomonnaies, y compris SOL (Solana), sont soumises à une volatilité de prix extrême. 
              Leur valeur peut fluctuer considérablement en très peu de temps, ce qui peut entraîner 
              des pertes financières importantes.
            </p>

            <h3 className="text-xl font-bold text-neon-purple mt-6 mb-3">2.2 Risque de Perte Totale</h3>
            <p>
              Vous pouvez perdre la totalité de votre investissement. N'investissez que des montants 
              que vous pouvez vous permettre de perdre complètement.
            </p>

            <h3 className="text-xl font-bold text-neon-purple mt-6 mb-3">2.3 Absence de Garantie ou d'Assurance</h3>
            <p>
              Contrairement aux dépôts bancaires traditionnels, les cryptomonnaies ne sont assurées par 
              aucun système de garantie des dépôts ni garanties par une autorité gouvernementale.
            </p>

            <h3 className="text-xl font-bold text-neon-purple mt-6 mb-3">2.4 Risques de Marché</h3>
            <p>
              Les marchés de cryptomonnaies sont relativement nouveaux, non réglementés dans de nombreuses 
              juridictions, et peuvent être sujets à la manipulation, à la fraude et à d'autres abus de marché.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">3. Risques Techniques et Blockchain</h2>

            <h3 className="text-xl font-bold text-neon-purple mt-6 mb-3">3.1 Irréversibilité des Transactions</h3>
            <p>
              <strong>Les transactions blockchain sont irréversibles.</strong> Une fois confirmée, une transaction 
              ne peut être annulée, modifiée ou remboursée. Vérifiez toujours attentivement tous les détails 
              d'une transaction avant de la confirmer.
            </p>

            <h3 className="text-xl font-bold text-neon-purple mt-6 mb-3">3.2 Perte des Clés Privées</h3>
            <p>
              La perte de vos clés privées ou de votre phrase de récupération entraîne une perte permanente 
              et irrécupérable de vos fonds. SOLcloser n'a jamais accès à vos clés privées et ne peut pas 
              récupérer les fonds perdus.
            </p>
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg mt-4">
              <p className="font-bold text-red-400">
                Vous êtes seul responsable de la sécurisation et de la sauvegarde de vos identifiants de portefeuille.
              </p>
            </div>

            <h3 className="text-xl font-bold text-neon-purple mt-6 mb-3">3.3 Vulnérabilités des Smart Contracts</h3>
            <p>
              Les smart contracts peuvent contenir des bugs, des vulnérabilités ou des failles de sécurité 
              pouvant entraîner la perte de fonds. Bien que nous nous efforcions d'assurer la sécurité, 
              aucun smart contract ne peut être garanti sûr à 100%.
            </p>

            <h3 className="text-xl font-bold text-neon-purple mt-6 mb-3">3.4 Risques Réseau</h3>
            <p>
              Le réseau Solana peut connaître :
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Une congestion entraînant des transactions échouées ou retardées</li>
              <li>Des pannes ou temps d'arrêt du réseau</li>
              <li>Des hard forks ou changements de protocole</li>
              <li>Des attaques à 51% ou autres défaillances de consensus</li>
            </ul>

            <h3 className="text-xl font-bold text-neon-purple mt-6 mb-3">3.5 Piratage et Violations de Sécurité</h3>
            <p>
              Les portefeuilles, exchanges et services blockchain peuvent être la cible de piratages, 
              d'attaques de phishing ou d'autres violations de sécurité. Utilisez toujours des pratiques 
              de sécurité robustes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">4. Risques Réglementaires et Juridiques</h2>

            <h3 className="text-xl font-bold text-neon-purple mt-6 mb-3">4.1 Incertitude Réglementaire</h3>
            <p>
              La réglementation des cryptomonnaies évolue et varie selon les juridictions. De nouvelles 
              lois ou réglementations peuvent affecter la légalité, la taxation ou l'utilisation des cryptomonnaies.
            </p>
            <p className="mt-4">
              Les actions réglementaires futures pourraient :
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Interdire ou restreindre la propriété ou le trading de cryptomonnaies</li>
              <li>Imposer des taxes ou obligations déclaratives supplémentaires</li>
              <li>Affecter la valeur ou l'utilité des cryptomonnaies</li>
              <li>Impacter la disponibilité de services comme SOLcloser</li>
            </ul>

            <h3 className="text-xl font-bold text-neon-purple mt-6 mb-3">4.2 Obligations Fiscales</h3>
            <p>
              Les gains en cryptomonnaies peuvent être soumis à l'impôt dans votre juridiction. Vous êtes 
              responsable de comprendre et de respecter toutes les lois fiscales applicables.
            </p>
            <p className="mt-4">
              Le non-respect des obligations fiscales peut entraîner des pénalités, amendes ou poursuites judiciaires.
            </p>

            <h3 className="text-xl font-bold text-neon-purple mt-6 mb-3">4.3 Statut Juridique Variable</h3>
            <p>
              Le statut juridique des cryptomonnaies varie considérablement d'un pays à l'autre et peut 
              changer sans préavis. Assurez-vous que votre utilisation de SOLcloser est conforme à toutes 
              les lois applicables dans votre juridiction.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">5. Risques Spécifiques à SOLcloser</h2>

            <h3 className="text-xl font-bold text-neon-purple mt-6 mb-3">5.1 Service "En l'État"</h3>
            <p>
              SOLcloser est fourni "en l'état" sans garantie d'aucune sorte. Nous ne garantissons pas que 
              le Service sera exempt d'erreurs, de bugs ou d'interruptions.
            </p>

            <h3 className="text-xl font-bold text-neon-purple mt-6 mb-3">5.2 Disponibilité du Service</h3>
            <p>
              Le Service peut être interrompu, suspendu ou arrêté à tout moment, avec ou sans préavis.
            </p>

            <h3 className="text-xl font-bold text-neon-purple mt-6 mb-3">5.3 Frais de Transaction</h3>
            <p>
              En plus des frais de service de SOLcloser (20%), des frais de réseau Solana s'appliquent 
              à toutes les transactions. Ces frais peuvent varier en fonction de la congestion du réseau 
              et ne sont pas contrôlés par SOLcloser.
            </p>

            <h3 className="text-xl font-bold text-neon-purple mt-6 mb-3">5.4 Dépendances Tierces</h3>
            <p>
              SOLcloser dépend de services tiers (fournisseurs RPC, plateformes d'hébergement, infrastructure 
              blockchain). Les problèmes avec ces services peuvent affecter la fonctionnalité de SOLcloser.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">6. Limitation de Responsabilité</h2>
            <p>
              Dans la mesure maximale permise par la loi, SOLcloser et ses opérateurs ne sauraient être 
              tenus responsables de :
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Toute perte financière résultant de l'utilisation du Service</li>
              <li>Erreurs de transaction ou transactions échouées</li>
              <li>Perte de fonds due à une erreur utilisateur</li>
              <li>Perte de clés privées ou d'accès au portefeuille</li>
              <li>Dysfonctionnements ou pannes du réseau Solana</li>
              <li>Défaillances de services tiers</li>
              <li>Piratage, phishing ou violations de sécurité</li>
              <li>Changements réglementaires affectant l'utilisation des cryptomonnaies</li>
              <li>Changements dans la valeur des cryptomonnaies</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">7. Meilleures Pratiques de Sécurité</h2>
            <p>Pour minimiser les risques, nous recommandons :</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>✅ Sauvegarder votre phrase de récupération dans plusieurs endroits sûrs</li>
              <li>✅ Ne jamais partager vos clés privées ou phrase de récupération</li>
              <li>✅ Vérifier tous les détails de transaction avant de signer</li>
              <li>✅ Utiliser des portefeuilles matériels pour les montants importants</li>
              <li>✅ Activer l'authentification à deux facteurs (2FA) lorsque disponible</li>
              <li>✅ Être vigilant contre les tentatives de phishing</li>
              <li>✅ N'investir que des montants que vous pouvez vous permettre de perdre</li>
              <li>✅ Maintenir vos logiciels et appareils à jour</li>
              <li>✅ Vous éduquer continuellement sur la sécurité blockchain</li>
              <li>✅ Ne jamais accéder à votre portefeuille sur des réseaux publics ou non sécurisés</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">8. Aucune Garantie ni Promesse</h2>
            <p>
              SOLcloser ne fait aucune garantie, promesse ou déclaration concernant :
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Le montant de SOL que vous pourrez récupérer</li>
              <li>Le taux de succès des transactions</li>
              <li>La valeur ou le prix futur du SOL ou de toute cryptomonnaie</li>
              <li>La disponibilité ou la continuité du Service</li>
              <li>La compatibilité avec les futures mises à niveau de la blockchain</li>
              <li>La conformité réglementaire dans toutes les juridictions</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">9. Responsabilité de l'Utilisateur</h2>
            <p>
              Vous reconnaissez et acceptez que :
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Vous utilisez SOLcloser à vos propres risques</li>
              <li>Vous êtes seul responsable de vos décisions</li>
              <li>Vous avez les connaissances techniques pour utiliser des applications blockchain</li>
              <li>Vous comprenez les risques liés aux transactions de cryptomonnaies</li>
              <li>Vous effectuerez vos propres recherches et due diligence</li>
              <li>Vous vous conformerez à toutes les lois et règlements applicables</li>
              <li>Vous acceptez l'entière responsabilité de la sécurité de votre portefeuille</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">10. Acceptation des Risques</h2>
            <div className="p-6 bg-yellow-500/10 border-2 border-yellow-500/50 rounded-lg">
              <p className="font-bold text-yellow-400 mb-4">
                EN UTILISANT SOLCLOSER, VOUS RECONNAISSEZ :
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Avoir lu et compris cet avertissement sur les risques</li>
                <li>Être conscient des risques inhérents aux cryptomonnaies et à la technologie blockchain</li>
                <li>Accepter l'entière responsabilité de vos décisions et actions</li>
                <li>Comprendre que SOLcloser ne fournit aucun conseil financier</li>
                <li>Être seul responsable de la sécurité de votre portefeuille</li>
                <li>Accepter que les transactions blockchain sont irréversibles</li>
                <li>Vous conformer à toutes les lois et règlements applicables</li>
                <li>Comprendre et accepter tous les risques décrits dans ce document</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">11. Contact</h2>
            <p>
              Pour toute question concernant cet avertissement :
            </p>
            <div className="p-4 bg-dark-card border border-dark-border rounded-lg mt-4">
              <p>
                <strong>Email :</strong> solcloser@gmail.com<br />
                <strong>GitHub :</strong> <a href="https://github.com/SolFinder-project/sol-closer" className="text-neon-pink hover:underline" target="_blank" rel="noopener noreferrer">
                  github.com/SolFinder-project/sol-closer
                </a>
              </p>
            </div>
          </section>

          <div className="mt-12 pt-8 border-t border-dark-border">
            <p className="text-sm text-gray-500 italic">
              Cet avertissement ne constitue pas un conseil juridique, financier ou en investissement. 
              Consultez toujours des professionnels qualifiés avant de prendre des décisions financières.
            </p>
          </div>
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
