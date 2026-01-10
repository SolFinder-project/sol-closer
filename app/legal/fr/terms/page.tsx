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
          Conditions Générales d'Utilisation
        </h1>
        
        <div className="prose prose-invert max-w-none space-y-6 text-gray-300">
          <p className="text-sm text-gray-500">Dernière mise à jour : [À COMPLÉTER]</p>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">1. Préambule</h2>
            <p>
              Les présentes Conditions Générales d'Utilisation (ci-après "CGU") régissent l'utilisation 
              de l'application décentralisée SOLcloser (ci-après "le Service"), éditée par :
            </p>
            <div className="p-4 bg-dark-card border border-dark-border rounded-lg mt-4">
              <p>
                <strong>Raison sociale :</strong> [À COMPLÉTER]<br />
                <strong>Forme juridique :</strong> [À COMPLÉTER - ex: Auto-entrepreneur]<br />
                <strong>SIRET :</strong> [À COMPLÉTER]<br />
                <strong>Adresse :</strong> [À COMPLÉTER]<br />
                <strong>Email :</strong> [À COMPLÉTER]
              </p>
            </div>
            <p className="mt-4">
              L'utilisation du Service implique l'acceptation pleine et entière des présentes CGU. 
              Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser le Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">2. Objet</h2>
            <p>
              SOLcloser est une application décentralisée permettant aux utilisateurs d'identifier et 
              de fermer les comptes de tokens SPL inutilisés sur la blockchain Solana afin de récupérer 
              les dépôts de loyer (SOL).
            </p>
            <p>Le Service propose :</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>L'analyse des portefeuilles connectés pour identifier les comptes de tokens vides</li>
              <li>La facilitation de la fermeture de ces comptes via des transactions blockchain</li>
              <li>Un système de commission de 20% sur le SOL récupéré</li>
              <li>Un programme de parrainage offrant 10% de récompenses</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">3. Accès au Service</h2>
            <p>
              Le Service est accessible gratuitement à toute personne disposant d'un accès internet 
              et d'un portefeuille Solana compatible. Tous les coûts liés à l'accès au Service 
              (matériel informatique, connexion internet) sont à la charge exclusive de l'utilisateur.
            </p>
            <p>
              L'utilisateur s'engage à accéder au Service en utilisant un matériel récent, ne contenant 
              pas de virus et avec un navigateur de dernière génération mis à jour.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">4. Obligations de l'Utilisateur</h2>
            <p>L'utilisateur s'engage à :</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Fournir des informations exactes lors de l'utilisation du Service</li>
              <li>Maintenir la sécurité de son portefeuille et de ses clés privées</li>
              <li>Vérifier attentivement toutes les transactions avant de les signer</li>
              <li>Utiliser le Service conformément aux lois et règlements en vigueur</li>
              <li>Ne pas tenter de contourner, désactiver ou manipuler le Service</li>
              <li>Ne pas utiliser le Service à des fins illégales, notamment le blanchiment d'argent</li>
              <li>Déclarer les gains en cryptomonnaies conformément à la législation fiscale française</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">5. Tarification et Modalités de Paiement</h2>
            
            <h3 className="text-xl font-bold text-neon-purple mt-6 mb-3">5.1 Commission de Service</h3>
            <p>
              SOLcloser prélève une commission de 20% sur le montant de SOL récupéré lors de la fermeture 
              des comptes de tokens. Cette commission est automatiquement déduite lors du traitement de 
              la transaction.
            </p>
            <p>
              Le montant exact de la commission est clairement affiché à l'utilisateur avant la confirmation 
              de toute transaction. L'utilisateur recevra approximativement 80% du SOL récupéré, déduction 
              faite des frais de réseau Solana.
            </p>

            <h3 className="text-xl font-bold text-neon-purple mt-6 mb-3">5.2 Programme de Parrainage</h3>
            <p>
              Les utilisateurs peuvent participer au programme de parrainage en partageant leur lien unique. 
              Le parrain reçoit 10% du SOL récupéré par les utilisateurs qu'il a parrainés, ce pourcentage 
              étant déduit de la commission de service.
            </p>

            <h3 className="text-xl font-bold text-neon-purple mt-6 mb-3">5.3 Facturation</h3>
            <p>
              Les transactions étant effectuées directement sur la blockchain Solana, aucune facture 
              traditionnelle n'est émise. L'utilisateur peut consulter l'historique de ses transactions 
              sur l'explorateur de blockchain Solana.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">6. Droit de Rétractation</h2>
            <p>
              Conformément à l'article L.221-28 du Code de la consommation, le droit de rétractation 
              ne peut être exercé pour les contrats de fourniture de contenu numérique non fourni sur 
              un support matériel dont l'exécution a commencé avec l'accord préalable exprès du consommateur 
              et renoncement exprès à son droit de rétractation.
            </p>
            <p className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg mt-4">
              <strong>Important :</strong> En raison de la nature immédiate et irréversible des transactions 
              blockchain, et par la validation explicite de l'utilisateur avant chaque transaction, 
              le droit de rétractation ne peut s'appliquer une fois la transaction confirmée sur la blockchain.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">7. Responsabilité et Garanties</h2>
            
            <h3 className="text-xl font-bold text-neon-purple mt-6 mb-3">7.1 Limitation de Responsabilité</h3>
            <p>
              Le Service est fourni "en l'état" et "selon disponibilité". SOLcloser ne garantit pas que 
              le Service sera exempt d'erreurs, de virus ou autres éléments nuisibles, ni que les défauts 
              seront corrigés.
            </p>
            <p>
              SOLcloser ne pourra être tenu responsable des dommages directs ou indirects causés au matériel 
              de l'utilisateur lors de l'accès au Service, ni des dommages résultant de l'utilisation ou de 
              l'impossibilité d'utiliser le Service.
            </p>

            <h3 className="text-xl font-bold text-neon-purple mt-6 mb-3">7.2 Absence de Conseil</h3>
            <p>
              SOLcloser ne fournit aucun conseil en investissement, conseil financier, conseil juridique 
              ou conseil fiscal. Les utilisateurs sont seuls responsables de leurs décisions d'utilisation 
              du Service et doivent consulter leurs propres conseillers professionnels si nécessaire.
            </p>

            <h3 className="text-xl font-bold text-neon-purple mt-6 mb-3">7.3 Risques liés à la Blockchain</h3>
            <p>
              L'utilisateur reconnaît et accepte les risques inhérents à l'utilisation de la technologie 
              blockchain, notamment :
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>La volatilité des cryptomonnaies</li>
              <li>L'irréversibilité des transactions</li>
              <li>Les risques de vulnérabilités des smart contracts</li>
              <li>Les risques de congestion du réseau</li>
              <li>La perte définitive de fonds en cas de perte des clés privées</li>
              <li>L'incertitude réglementaire</li>
            </ul>

            <h3 className="text-xl font-bold text-neon-purple mt-6 mb-3">7.4 Sécurité du Portefeuille</h3>
            <p>
              L'utilisateur est seul responsable de la sécurité de son portefeuille et de ses clés privées. 
              SOLcloser n'a jamais accès aux clés privées des utilisateurs et ne peut pas récupérer les 
              fonds perdus ou annuler des transactions.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">8. Propriété Intellectuelle</h2>
            <p>
              L'ensemble des éléments du Service (structure, logiciels, textes, images, graphismes, logo, 
              icônes, etc.) est la propriété exclusive de SOLcloser, à l'exception des marques, logos ou 
              contenus appartenant à d'autres sociétés partenaires ou auteurs.
            </p>
            <p>
              Le code source de SOLcloser est publié sous licence Creative Commons Attribution-NonCommercial-ShareAlike 
              4.0 International (CC BY-NC-SA 4.0). Toute utilisation commerciale nécessite une autorisation 
              explicite écrite.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">9. Données Personnelles</h2>
            <p>
              SOLcloser s'engage à respecter la vie privée de ses utilisateurs conformément au Règlement 
              Général sur la Protection des Données (RGPD) et à la loi Informatique et Libertés.
            </p>
            <p>
              Pour plus d'informations sur la collecte et le traitement des données, veuillez consulter 
              notre <Link href="/legal/privacy" className="text-neon-pink hover:underline">Politique de Confidentialité</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">10. Obligations Fiscales</h2>
            <p>
              Conformément à la législation fiscale française, les utilisateurs sont tenus de déclarer 
              les gains réalisés en cryptomonnaies auprès de l'administration fiscale.
            </p>
            <p>
              Les gains provenant de la récupération de SOL via SOLcloser peuvent être soumis à l'impôt 
              sur le revenu. Il appartient à chaque utilisateur de se conformer à ses obligations fiscales.
            </p>
            <p>
              SOLcloser ne fournit aucun conseil fiscal et recommande aux utilisateurs de consulter un 
              conseiller fiscal professionnel.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">11. Lutte Anti-Blanchiment</h2>
            <p>
              Conformément aux obligations de lutte contre le blanchiment d'argent et le financement du 
              terrorisme, SOLcloser se réserve le droit de suspendre ou refuser l'accès au Service en cas 
              de soupçon d'activité frauduleuse ou illégale.
            </p>
            <p>
              Les utilisateurs s'engagent à ne pas utiliser le Service à des fins de blanchiment d'argent 
              ou de financement d'activités illégales.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">12. Modification du Service et des CGU</h2>
            <p>
              SOLcloser se réserve le droit de modifier, suspendre ou interrompre tout ou partie du Service 
              à tout moment, sans préavis et sans indemnité.
            </p>
            <p>
              Les présentes CGU peuvent être modifiées à tout moment. Les utilisateurs seront informés de 
              toute modification substantielle par mise à jour de la date en haut de ce document. L'utilisation 
              continue du Service après modification vaut acceptation des nouvelles CGU.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">13. Résiliation</h2>
            <p>
              SOLcloser se réserve le droit de suspendre ou résilier l'accès d'un utilisateur au Service, 
              sans préavis ni indemnité, en cas de violation des présentes CGU ou d'utilisation frauduleuse 
              du Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">14. Médiation et Règlement des Litiges</h2>
            <p>
              Conformément à l'article L.612-1 du Code de la consommation, tout consommateur a le droit de 
              recourir gratuitement à un médiateur de la consommation en vue de la résolution amiable d'un 
              litige qui l'opposerait à SOLcloser.
            </p>
            <p>
              Plateforme de règlement en ligne des litiges (RLL) :<br />
              <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer" className="text-neon-pink hover:underline">
                https://ec.europa.eu/consumers/odr/
              </a>
            </p>
            <p className="mt-4">
              Médiateur de la consommation : [À COMPLÉTER]
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">15. Droit Applicable et Juridiction Compétente</h2>
            <p>
              Les présentes CGU sont régies par le droit français.
            </p>
            <p>
              En cas de litige, et après échec de toute tentative de recherche d'une solution amiable ou de 
              médiation, les tribunaux français seront seuls compétents pour en connaître, conformément aux 
              règles de compétence applicables.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">16. Contact</h2>
            <p>
              Pour toute question concernant les présentes CGU, vous pouvez nous contacter :
            </p>
            <div className="p-4 bg-dark-card border border-dark-border rounded-lg mt-4">
              <p>
                <strong>Email :</strong> [À COMPLÉTER]<br />
                <strong>Adresse :</strong> [À COMPLÉTER]<br />
                <strong>GitHub :</strong> <a href="https://github.com/SolFinder-project/sol-closer" target="_blank" rel="noopener noreferrer" className="text-neon-pink hover:underline">
                  https://github.com/SolFinder-project/sol-closer
                </a>
              </p>
            </div>
          </section>

          <div className="mt-12 pt-8 border-t border-dark-border">
            <p className="text-sm text-gray-500">
              En utilisant SOLcloser, vous reconnaissez avoir lu, compris et accepté les présentes 
              Conditions Générales d'Utilisation.
            </p>
          </div>
        </div>

        <div className="mt-12">
          <Link href="/" className="btn-cyber inline-block">
            ← Retour à l'accueil
          </Link>
        </div>
      </div>
    </main>
  );
}
