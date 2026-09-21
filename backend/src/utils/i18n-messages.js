/**
 * Messages de l'API en arabe pour l'app cliente (contrainte bilingue FR/AR du
 * classeur : « tout texte visible par l'utilisateur existe en français ET en
 * arabe »). Les services continuent d'écrire en français ; le middleware
 * `localizeMessages` traduit le champ `message` des réponses /customer/* quand
 * l'app envoie l'en-tête `X-Lang: ar` (ou `Accept-Language: ar`).
 *
 * EXACT    : message fixe → traduction.
 * PATTERNS : message avec valeurs variables ; {1}, {2}… repèrent les valeurs,
 *            recopiées telles quelles dans la phrase arabe.
 * Un message absent des deux listes reste en français (messages techniques ou
 * propres au back-office, que l'app client n'affiche pas).
 */

const EXACT = {
  // ── Génériques
  'Success': 'تمت العملية بنجاح',
  'Erreur interne du serveur': 'حدث خطأ في الخادم، يرجى المحاولة لاحقًا',
  'Ressource introuvable': 'العنصر غير موجود',
  'Paramètre invalide': 'معطى غير صالح',
  'Cette valeur existe déjà': 'هذه القيمة موجودة مسبقًا',
  "Opération impossible : cet élément est lié à d'autres données": 'العملية غير ممكنة: هذا العنصر مرتبط ببيانات أخرى',
  'Corps JSON invalide ou vide': 'طلب غير صالح',
  'Non autorisé': 'غير مسموح',
  'Champs requis': 'حقول مطلوبة',
  'Valeur invalide': 'قيمة غير صالحة',
  'Quantité invalide': 'كمية غير صالحة',
  'Fichier requis': 'الملف مطلوب',
  'Aucun fichier envoyé': 'لم يتم إرسال أي ملف',
  'Format de date invalide (AAAA-MM-JJ attendu)': 'صيغة التاريخ غير صالحة',

  // ── Session et compte
  'Token requis': 'يرجى تسجيل الدخول',
  'Token manquant': 'يرجى تسجيل الدخول',
  'Token invalide ou expiré': 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول من جديد',
  'Token invalide: id manquant': 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول من جديد',
  'Token invalide: userId manquant': 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول من جديد',
  'Compte client introuvable': 'حساب العميل غير موجود',
  'Compte client bloqué': 'حسابك موقوف',
  'Votre compte est suspendu. Contactez le support Atina.': 'حسابك موقوف. يرجى التواصل مع دعم أتينا.',
  'Compte introuvable': 'الحساب غير موجود',
  'Compte non activé.': 'الحساب غير مفعّل.',
  'Compte non activé. Vérifiez votre code OTP.': 'الحساب غير مفعّل. تحقق من رمز التأكيد.',
  'Compte créé. Entrez le code OTP pour activer.': 'تم إنشاء الحساب. أدخل رمز التأكيد لتفعيله.',
  'Accès non autorisé.': 'دخول غير مسموح.',
  'Utilisateur introuvable': 'المستخدم غير موجود',
  'Utilisateur non trouvé.': 'المستخدم غير موجود.',
  'Numéro non trouvé.': 'الرقم غير موجود.',
  'Numéro non trouvé. Vérifiez et réessayez.': 'الرقم غير موجود. تحقق منه وأعد المحاولة.',
  'Numéro de téléphone non trouvé.': 'رقم الهاتف غير موجود.',
  'Numéro invalide': 'رقم غير صالح',
  'Numéro requis': 'الرقم مطلوب',
  'Numéro de téléphone invalide (8 à 12 chiffres)': 'رقم الهاتف غير صالح (من 8 إلى 12 رقمًا)',
  'Ce numéro est déjà utilisé': 'هذا الرقم مستعمل مسبقًا',
  'Ce numéro est déjà utilisé.': 'هذا الرقم مستعمل مسبقًا.',
  'Email non trouvé.': 'البريد الإلكتروني غير موجود.',
  'Email invalide': 'بريد إلكتروني غير صالح',
  'Email obligatoire': 'البريد الإلكتروني مطلوب',
  'Email obligatoire.': 'البريد الإلكتروني مطلوب.',
  'Cet email est déjà utilisé': 'هذا البريد الإلكتروني مستعمل مسبقًا',
  'Cet email est déjà utilisé.': 'هذا البريد الإلكتروني مستعمل مسبقًا.',
  'Email mis à jour': 'تم تحديث البريد الإلكتروني',
  'Téléphone mis à jour': 'تم تحديث رقم الهاتف',
  'Mot de passe incorrect': 'كلمة المرور غير صحيحة',
  'Mot de passe incorrect.': 'كلمة المرور غير صحيحة.',
  'Mot de passe actuel incorrect': 'كلمة المرور الحالية غير صحيحة',
  'Mot de passe minimum 6 caractères': 'كلمة المرور 6 أحرف على الأقل',
  'Mot de passe minimum 6 caractères.': 'كلمة المرور 6 أحرف على الأقل.',
  'Min. 6 caractères': '6 أحرف على الأقل',
  'Mot de passe modifié': 'تم تغيير كلمة المرور',
  'Mot de passe modifié avec succès.': 'تم تغيير كلمة المرور بنجاح.',
  'Aucun mot de passe défini': 'لم يتم تعيين كلمة مرور',
  'Nom invalide': 'اسم غير صالح',
  'Le nom du client est obligatoire': 'الاسم مطلوب',
  'Aucun champ à mettre à jour': 'لا يوجد ما يجب تحديثه',
  'Ville introuvable': 'المدينة غير موجودة',
  'Ville requise': 'المدينة مطلوبة',
  'Code de parrainage introuvable': 'رمز الإحالة غير موجود',
  'Un code de parrainage est déjà enregistré sur votre compte': 'تم تسجيل رمز إحالة في حسابك مسبقًا',
  'Vous ne pouvez pas utiliser votre propre code': 'لا يمكنك استعمال رمزك الخاص',
  'Code de confirmation requis': 'رمز التأكيد مطلوب',
  'Votre portefeuille contient encore de l’argent : contactez le support pour le récupérer avant de supprimer votre compte.':
    'ما زال في محفظتك رصيد: تواصل مع الدعم لاسترجاعه قبل حذف حسابك.',
  'Compte supprimé': 'تم حذف الحساب',

  // ── Code SMS
  'Code envoyé': 'تم إرسال الرمز',
  'Code envoyé par SMS': 'تم إرسال الرمز عبر رسالة قصيرة',
  'Code envoyé (mode test : 0000)': 'تم إرسال الرمز (وضع التجربة: 0000)',
  'OTP envoyé (mode test : 0000)': 'تم إرسال الرمز (وضع التجربة: 0000)',
  'Code de vérification envoyé': 'تم إرسال رمز التحقق',
  'Code incorrect': 'الرمز غير صحيح',
  'Code incorrect.': 'الرمز غير صحيح.',
  'Code incorrect. Réessayez.': 'الرمز غير صحيح. أعد المحاولة.',
  'Code expiré, redemandez-en un': 'انتهت صلاحية الرمز، اطلب رمزًا جديدًا',
  'Code expiré. Demandez un nouveau code.': 'انتهت صلاحية الرمز. اطلب رمزًا جديدًا.',
  'Code requis': 'الرمز مطلوب',
  'otp requis': 'الرمز مطلوب',
  'phone_number et otp requis': 'رقم الهاتف والرمز مطلوبان',
  'phone_number ou email requis': 'رقم الهاتف أو البريد الإلكتروني مطلوب',
  'phone_number requis': 'رقم الهاتف مطلوب',

  // ── Adresses
  'Adresse introuvable': 'العنوان غير موجود',
  'Adresse supprimée': 'تم حذف العنوان',
  'Nom de rue requis': 'اسم الشارع مطلوب',
  'La rue / adresse est obligatoire': 'العنوان مطلوب',
  "La ville est obligatoire (l'adresse doit être rattachée à une ville)": 'المدينة مطلوبة',
  'Code postal invalide (5 chiffres)': 'الرمز البريدي غير صالح (5 أرقام)',
  "L'adresse ne correspond pas à ce client": 'هذا العنوان لا يخص حسابك',
  'Adresse de livraison requise pour une livraison à domicile': 'عنوان التوصيل مطلوب للتوصيل إلى المنزل',
  'address_id requis': 'العنوان مطلوب',
  'address_id requis pour livraison à domicile': 'عنوان التوصيل مطلوب للتوصيل إلى المنزل',

  // ── Catalogue et panier
  'Produit introuvable': 'المنتج غير موجود',
  'Article introuvable': 'المنتج غير موجود',
  'SKU introuvable': 'المنتج غير موجود',
  'Ce produit n\'est plus disponible': 'هذا المنتج لم يعد متوفرًا',
  'Catégorie introuvable ou supprimée.': 'الفئة غير موجودة.',
  'Famille introuvable': 'العائلة غير موجودة',
  'Article ajouté au panier': 'تمت إضافة المنتج إلى السلة',
  'Article supprimé': 'تم حذف المنتج',
  'Article introuvable dans le panier': 'المنتج غير موجود في السلة',
  'Pack ajouté au panier': 'تمت إضافة الباقة إلى السلة',
  'Pack mis à jour': 'تم تحديث الباقة',
  'Pack supprimé': 'تم حذف الباقة',
  'Pack introuvable': 'الباقة غير موجودة',
  'Pack introuvable dans le panier': 'الباقة غير موجودة في السلة',
  'Pack introuvable ou indisponible': 'الباقة غير موجودة أو غير متوفرة',
  'Ce pack ne contient aucun produit': 'هذه الباقة لا تحتوي على أي منتج',
  'Quantité mise à jour': 'تم تحديث الكمية',
  'Panier introuvable': 'السلة غير موجودة',
  'Panier vide': 'السلة فارغة',
  'Panier vidé': 'تم إفراغ السلة',
  'Panier vide — cart_items requis': 'السلة فارغة',
  'Retiré des favoris': 'تمت الإزالة من المفضلة',
  "Aucun article de cette commande n'est disponible": 'لا يتوفر أي منتج من هذا الطلب',
  'cart_items : JSON invalide': 'محتوى السلة غير صالح',
  'cart_items: sku_id ou pack_id requis': 'محتوى السلة غير صالح',
  'sku_id requis': 'المنتج مطلوب',
  'pack_id requis': 'الباقة مطلوبة',

  // ── Commande, créneaux, paiement
  'Commande introuvable': 'الطلب غير موجود',
  'Type de livraison introuvable': 'نوع التوصيل غير موجود',
  'delivery_type_id ou delivery_type_code requis': 'نوع التوصيل مطلوب',
  'Aucun node éligible pour cette adresse et ce panier': 'لا يوجد متجر يخدم هذا العنوان لهذه السلة',
  'Node introuvable': 'المتجر غير موجود',
  'Node introuvable ou inactif': 'المتجر غير موجود أو غير نشط',
  'Nœud introuvable ou inactif': 'المتجر غير موجود أو غير نشط',
  'node_id requis': 'المتجر مطلوب',
  'node_id requis pour retrait magasin': 'اختر متجر الاستلام',
  'Ce créneau est complet, choisissez-en un autre': 'هذا الموعد ممتلئ، اختر موعدًا آخر',
  'Le créneau choisi est désactivé': 'الموعد المختار لم يعد متاحًا',
  "Le créneau choisi n'appartient pas à ce nœud": 'الموعد المختار لا يخص هذا المتجر',
  'Magasin (node) requis pour un échange de points': 'اختر المتجر لاستبدال النقاط',
  'exchange_items : tableau attendu': 'منتجات الاستبدال غير صالحة',
  'Lot déjà réclamé ou expiré : recalculez votre panier': 'الجائزة مستلمة أو منتهية الصلاحية: أعد حساب سلتك',

  // ── Codes promo
  'Code promo introuvable': 'رمز التخفيض غير موجود',
  'Ce code promo a expiré': 'انتهت صلاحية رمز التخفيض',
  "Ce code promo n'est pas encore valide": 'رمز التخفيض غير صالح بعد',
  "Ce code promo n'est plus actif": 'رمز التخفيض لم يعد نشطًا',
  "Ce code promo a atteint sa limite d'utilisation": 'بلغ رمز التخفيض الحد الأقصى للاستعمال',
  'Ce code promo ne vous est pas destiné': 'رمز التخفيض هذا ليس موجهًا إليك',
  "Ce code promo n'est pas valable sur ce point de vente": 'رمز التخفيض غير صالح في هذا المتجر',
  "Ce code promo n'est pas cumulable avec les offres déjà présentes dans votre panier": 'لا يمكن الجمع بين رمز التخفيض والعروض الموجودة في سلتك',
  'Vous avez déjà utilisé ce code promo': 'لقد استعملت رمز التخفيض هذا مسبقًا',
  'Commande introuvable ou sans code promo': 'الطلب غير موجود أو بدون رمز تخفيض',

  // ── Avis, réclamations, support
  'Avis introuvable': 'التقييم غير موجود',
  'Avis supprimé': 'تم حذف التقييم',
  'Note invalide (1-5)': 'التقييم غير صالح (من 1 إلى 5)',
  'Vous avez déjà laissé un avis sur cet article': 'لقد قيّمت هذا المنتج مسبقًا',
  'Réclamation introuvable': 'الشكوى غير موجودة',
  'Réclamation annulée': 'تم إلغاء الشكوى',
  'Seules les réclamations ouvertes peuvent être annulées': 'لا يمكن إلغاء إلا الشكاوى المفتوحة',
  'Une réclamation de ce type est déjà en cours pour cette commande': 'توجد شكوى من هذا النوع قيد المعالجة لهذا الطلب',
  'Type de réclamation requis': 'نوع الشكوى مطلوب',
  'Description requise': 'الوصف مطلوب',
  'Photo supprimée': 'تم حذف الصورة',
  'Conversation introuvable': 'المحادثة غير موجودة',
  'Conversation supprimée': 'تم حذف المحادثة',
  'Cette conversation est fermée': 'هذه المحادثة مغلقة',
  'Contenu requis': 'المحتوى مطلوب',
  'Sujet requis': 'الموضوع مطلوب',
  'Notification introuvable': 'الإشعار غير موجود',

  // ── Substitutions
  'Substitution introuvable': 'الاستبدال غير موجود',
  'Cette substitution a déjà été traitée': 'تمت معالجة هذا الاستبدال مسبقًا',
  "Cet article n'est pas en attente de substitution": 'هذا المنتج ليس في انتظار استبدال',
  'Aucun produit de substitution associé': 'لا يوجد منتج بديل',
  'Statut invalide. Utiliser: accepted ou refused': 'اختيار غير صالح',
  'status requis (accepted | refused)': 'يرجى القبول أو الرفض',

  // ── Jeux, points, parrainage
  'Jeu introuvable': 'اللعبة غير موجودة',
  'Aucun lot disponible pour ce jeu': 'لا توجد جوائز متاحة لهذه اللعبة',
  'Lot introuvable': 'الجائزة غير موجودة',
  'Ce lot appartient à un autre client': 'هذه الجائزة تخص عميلًا آخر',
  "Cette partie n'a pas de lot à réclamer": 'لا توجد جائزة لاستلامها في هذه اللعبة',
  'Participation introuvable': 'المشاركة غير موجودة',
  'Produit échangé introuvable': 'منتج الاستبدال غير موجود',
  'Transaction de points introuvable.': 'عملية النقاط غير موجودة.',
  'Parrainage introuvable.': 'الإحالة غير موجودة.',
  'Génération du code promo impossible, réessayez': 'تعذر إنشاء رمز التخفيض، أعد المحاولة',
};

const PATTERNS = [
  ['Montant minimum de commande : {1} MAD (sous-total payé : {2} MAD, il manque {3} MAD)',
    'الحد الأدنى للطلب: {1} درهم (المجموع المدفوع: {2} درهم، ينقصك {3} درهم)'],
  ['Montant minimum de commande non atteint : {1} MAD requis, sous-total payé {2} MAD (il manque {3} MAD).',
    'لم يتم بلوغ الحد الأدنى للطلب: {1} درهم مطلوبة، المجموع المدفوع {2} درهم (ينقصك {3} درهم).'],
  ['Montant minimum de {1} DH requis', 'يلزم حد أدنى قدره {1} درهم'],
  ['Le mode de paiement « {1} » n\'est pas activé sur ce nœud', 'طريقة الأداء « {1} » غير مفعّلة في هذا المتجر'],
  ['Un article de votre panier est en rupture : livraison possible à partir du {1}', 'منتج في سلتك غير متوفر حاليًا: التوصيل ممكن ابتداءً من {1}'],
  ['Un article de votre panier est en rupture : choisissez un créneau à partir du {1}', 'منتج في سلتك غير متوفر حاليًا: اختر موعدًا ابتداءً من {1}'],
  ['Vous avez {1} commande(s) en cours : la suppression sera possible après leur livraison ou leur annulation.',
    'لديك {1} طلب(ات) قيد التنفيذ: يمكن الحذف بعد توصيلها أو إلغائها.'],
  ['Stock insuffisant pour « {1} » (disponible {2}, demandé {3}).', 'المخزون غير كافٍ لـ « {1} » (المتوفر {2}، المطلوب {3}).'],
  ['Stock insuffisant pour « {1} » (disponible {2}, demandé {3}) : {4}.', 'المخزون غير كافٍ لـ « {1} » (المتوفر {2}، المطلوب {3}): {4}.'],
  ['Stock insuffisant pour « {1} » échangé contre des points (disponible {2}, demandé {3})', 'المخزون غير كافٍ لـ « {1} » المستبدل بالنقاط (المتوفر {2}، المطلوب {3})'],
  ['Solde de points insuffisant : {1} point(s) disponible(s), {2} requis pour les produits échangés', 'رصيد النقاط غير كافٍ: {1} نقطة متاحة، و{2} مطلوبة لمنتجات الاستبدال'],
  ['Il vous faut au moins {1} points pour échanger.', 'تحتاج إلى {1} نقطة على الأقل للاستبدال.'],
  ['« {1} » : limite de {2} par client (déjà {3}, demandé {4}).', '« {1} »: الحد {2} لكل عميل (سبق {3}، المطلوب {4}).'],
  ['« {1} » : pack indisponible', '« {1} »: الباقة غير متوفرة'],
  ['« {1} » : produit indisponible', '« {1} »: المنتج غير متوفر'],
  ['« {1} » : quota de la vente flash épuisé, recalculez le panier.', '« {1} »: نفدت كمية العرض السريع، أعد حساب السلة.'],
  ['« {1} » a déjà été réclamé', '« {1} » تم استلامه مسبقًا'],
  ['« {1} » a expiré le {2} : il ne peut plus être réclamé', '« {1} » انتهت صلاحيته في {2}: لا يمكن استلامه'],
  ['« {1} » ne se réclame pas dans une commande', '« {1} » لا يُستلم ضمن طلب'],
  ['« {1} » se réclame uniquement sur le magasin du jeu « {2} »', '« {1} » يُستلم فقط في متجر اللعبة « {2} »'],
  ['« {1} » : {2} unité(s) maximum par commande en échange de points (demandé {3})', '« {1} »: {2} وحدة كحد أقصى لكل طلب مقابل النقاط (المطلوب {3})'],
  ['« {1} » n\'est pas vendable sur ce magasin', '« {1} » غير متاح للبيع في هذا المتجر'],
  ['« {1} » n\'est pas vendable sur ce nœud.', '« {1} » غير متاح للبيع في هذا المتجر.'],
  ['« {1} » n\'est plus disponible', '« {1} » لم يعد متوفرًا'],
  ['« {1} » n\'est plus échangeable contre des points sur ce magasin', '« {1} » لم يعد قابلًا للاستبدال بالنقاط في هذا المتجر'],
  ['{1} est indisponible pour le moment (rupture de stock ou plafond de vente atteint).', '{1} غير متوفر حاليًا (نفاد المخزون أو بلوغ الحد الأقصى للبيع).'],
  ['{1} : il ne reste que {2} pack(s) disponible(s), {3} demandé(s).', '{1}: تبقّى {2} باقة فقط، والمطلوب {3}.'],
  ['Le pack « {1} » est indisponible (plafond atteint ou composants en rupture).', 'الباقة « {1} » غير متوفرة (بلوغ الحد الأقصى أو نفاد المكونات).'],
  ['Le pack « {1} » est désactivé.', 'الباقة « {1} » غير نشطة.'],
  ['Le pack « {1} » est expiré', 'انتهت صلاحية الباقة « {1} »'],
  ['Le pack « {1} » n\'est pas encore disponible', 'الباقة « {1} » غير متاحة بعد'],
  ['Le pack « {1} » n\'est pas proposé sur ce nœud', 'الباقة « {1} » غير معروضة في هذا المتجر'],
  ['Le pack « {1} » n\'est pas proposé sur ce magasin', 'الباقة « {1} » غير معروضة في هذا المتجر'],
  ['Le pack « {1} » : {2} pack(s) assemblable(s) seulement, {3} demandé(s).', 'الباقة « {1} »: {2} فقط متاحة، والمطلوب {3}.'],
  ['Plafond de vente du pack atteint : il reste {1} pack(s) vendable(s).', 'بلغت الباقة الحد الأقصى للبيع: تبقّى {1}.'],
  ['Plafond du pack « {1} » : il reste {2} pack(s) vendable(s), {3} demandé(s).', 'الحد الأقصى للباقة « {1} »: تبقّى {2}، والمطلوب {3}.'],
  ['Aucun article de cette commande n\'a pu être ajouté : {1}', 'تعذرت إضافة أي منتج من هذا الطلب: {1}'],
  ['Participation non accordée : {1}', 'لم تُمنح المشاركة: {1}'],
  ['Type de livraison «{1}» non supporté', 'نوع التوصيل «{1}» غير مدعوم'],
];

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const COMPILED = PATTERNS.map(([fr, ar]) => {
  const src = escapeRe(fr).replace(/\\\{(\d)\\\}/g, '(.+?)');
  return { re: new RegExp(`^${src}$`, 's'), ar };
});

/** Langue demandée par l'app : en-tête X-Lang, sinon Accept-Language. */
function requestLang(req) {
  const h = String(req?.headers?.['x-lang'] || req?.headers?.['accept-language'] || '').toLowerCase();
  return h.startsWith('ar') ? 'ar' : 'fr';
}

function translate(message, lang) {
  if (lang !== 'ar' || typeof message !== 'string' || !message) return message;
  if (EXACT[message]) return EXACT[message];
  for (const { re, ar } of COMPILED) {
    const m = message.match(re);
    if (m) return ar.replace(/\{(\d)\}/g, (_, i) => m[Number(i)] ?? '');
  }
  return message;
}

/** Middleware : traduit le champ `message` des réponses JSON pour les clients arabophones. */
function localizeMessages(req, res, next) {
  const lang = requestLang(req);
  if (lang !== 'ar') return next();
  const json = res.json.bind(res);
  res.json = (body) => {
    if (body && typeof body === 'object' && typeof body.message === 'string') {
      return json({ ...body, message: translate(body.message, lang) });
    }
    return json(body);
  };
  return next();
}

module.exports = { translate, requestLang, localizeMessages, EXACT, PATTERNS };
