import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, StatusBar,
  TouchableOpacity, Image, ScrollView, ActivityIndicator,
  Dimensions, Platform, Alert, FlatList, NativeSyntheticEvent,
  NativeScrollEvent, Modal, TextInput,
} from 'react-native';
import { CONFIG } from '../../constants/config'
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useFonts,
  Poppins_600SemiBold, Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import {
  Inter_400Regular, Inter_500Medium,
  Inter_600SemiBold, Inter_700Bold,
} from '@expo-google-fonts/inter';
import { CatalogService, Article } from '../../services/catalog.service';
import { CartService } from '../../services/cart.service';
import { ProfileService } from '../../services/profile.service';
import { ReviewsService, Review, ReviewStats } from '../../services/reviews.service';
import { useCartActions } from '../../context/CartContext';
import ProductCard from '../../components/ui/ProductCard';

const { width, height } = Dimensions.get('window');
const RED    = '#E10600';
const IMG_H  = height * 0.42;

//Image carousel 
function ImageCarousel({ images }: { images: string[] }) {
  const [index, setIndex] = useState(0);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };
  if (!images.length) {
    return (
      <View style={[styles.heroContainer, styles.heroPlaceholder]}>
        <Feather name="image" size={64} color="#D0C9BF" />
      </View>
    );
  }
  return (
    <View style={styles.heroContainer}>
      <FlatList
        data={images} keyExtractor={(_, i) => String(i)}
        horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        onScroll={onScroll} scrollEventThrottle={16}
        renderItem={({ item }) => (
          <Image source={{ uri: item }} style={styles.heroImage} resizeMode="cover" />
        )}
      />
      {images.length > 1 && (
        <View style={styles.dots}>
          {images.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

//Star
function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1,2,3,4,5].map(i => (
        <Ionicons key={i} name="star" size={size} color={i <= rating ? '#F59E0B' : '#E5E7EB'} />
      ))}
    </View>
  );
}

//Avatar 
function Avatar({ name, avatarUrl, size = 40 }: { name: string; avatarUrl?: string | null; size?: number }) {
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const colors   = ['#EF4444','#3B82F6','#8B5CF6','#10B981','#F59E0B','#EC4899'];
  const color    = colors[name.charCodeAt(0) % colors.length];

  if (avatarUrl) {
    const uri = avatarUrl.startsWith('http') ? avatarUrl : CONFIG.STORAGE_URL + avatarUrl;
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }

  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size/2, backgroundColor: color }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.36 }]}>{initials}</Text>
    </View>
  );
}

// Carte avis 
function ReviewCard({ review, onVoted }: { review: Review; onVoted: (updated: Review) => void }) {
  const [voting, setVoting] = useState(false);
  const name = review.customer?.name ?? 'Client';
  const date = new Date(review.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

  const handleToggle = async () => {
    if (voting) return;
    setVoting(true);
    try {
      const updated = await ReviewsService.toggleHelpful(review.id);
      onVoted(updated);
    } catch (e: any) {
      Alert.alert('Erreur', e.message ?? 'Impossible de voter');
    } finally {
      setVoting(false);
    }
  };

  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <Avatar name={name} avatarUrl={review.customer?.avatar_url} size={40} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.reviewName}>{name}</Text>
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedText}>Vérifié</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 }}>
            <Stars rating={review.rating} size={13} />
            <Text style={styles.reviewDate}>{date}</Text>
          </View>
        </View>
      </View>
      {!!review.comment && (
        <Text style={styles.reviewComment}>{review.comment}</Text>
      )}
      <TouchableOpacity
        style={[styles.helpfulBtn, review.voted_by_me && styles.helpfulBtnActive]}
        onPress={handleToggle}
        disabled={voting}
        activeOpacity={0.7}
      >
        <Feather name="thumbs-up" size={13} color={review.voted_by_me ? RED : '#9CA3AF'} />
        <Text style={[styles.helpfulText, review.voted_by_me && { color: RED }]}>
          Utile · {review.helpful_count}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// Section avis 
function ReviewsSection({
  articleId, stats, reviews, onWriteReview, onReviewVoted,
}: {
  articleId: number;
  stats: ReviewStats | null;
  reviews: Review[];
  onWriteReview: () => void;
  onReviewVoted: (updated: Review) => void;
}) {
  const router = useRouter();
  if (!stats) return null;

  return (
    <View style={styles.reviewsSection}>
      {/* Barre note globale + distribution 5→1 */}
      {stats.review_count > 0 && (
        <View style={styles.ratingBar}>
          <Text style={styles.ratingBig}>{stats.average_rating?.toFixed(1)}</Text>
          <View style={{ flex: 1, marginLeft: 12, gap: 4 }}>
            {([5, 4, 3, 2, 1] as const).map((star) => {
              const count = stats.distribution?.[star] ?? 0;
              const pct = stats.review_count > 0 ? (count / stats.review_count) * 100 : 0;
              return (
                <View key={star} style={styles.ratingBarRow}>
                  <Text style={styles.ratingBarLabel}>{star}</Text>
                  <Ionicons name="star" size={11} color='#F59E0B' />
                  <View style={styles.ratingBarTrack}>
                    <View style={[styles.ratingBarFill, { width: `${pct}%` }]} />
                  </View>
                  <Text style={styles.ratingBarCount}>{count}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Header + "Voir tout" */}
      <View style={styles.reviewsHeader}>
        <Text style={styles.sectionLabel}>Tous les avis</Text>
        {stats.review_count > 3 && (
          <TouchableOpacity
            style={styles.seeAllBtn}
            onPress={() => router.push({ pathname: '/main/reviews' as any, params: { article_id: articleId } })}
          >
            <Text style={styles.seeAllText}>Voir tout</Text>
            <Feather name="chevron-right" size={14} color={RED} />
          </TouchableOpacity>
        )}
      </View>

      {/* Liste avis ( 3max) OU état vide */}
      {stats.review_count === 0 ? (
        <View style={styles.noReviewsBox}>
          <Feather name="message-circle" size={28} color="#D1D5DB" />
          <Text style={styles.noReviewsTitle}>Aucun avis pour le moment</Text>
          <Text style={styles.noReviewsSubtitle}>Soyez le premier à donner votre avis sur ce produit</Text>
        </View>
      ) : (
        reviews.slice(0, 3).map(r => <ReviewCard key={r.id} review={r} onVoted={onReviewVoted} />)
      )}
    </View>
  );
}

//Modal écrire un avis 
function WriteReviewModal({
  visible, articleId, onClose, onSuccess,
}: {
  visible: boolean;
  articleId: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [rating,    setRating]    = useState(0);
  const [comment,   setComment]   = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) return Alert.alert('Note requise', 'Veuillez sélectionner une note.');
    try {
      setSubmitting(true);
      await ReviewsService.create(articleId, { rating, comment });
      onSuccess();
      onClose();
    } catch (e: any) {
      Alert.alert('Erreur', e.message ?? 'Impossible d\'envoyer votre avis');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />

          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Laisser un avis</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={22} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* Étoiles */}
          <Text style={styles.modalLabel}>Votre note</Text>
          <View style={styles.starsRow}>
            {[1,2,3,4,5].map(i => (
              <TouchableOpacity key={i} onPress={() => setRating(i)} activeOpacity={0.7}>
                <Ionicons name="star" size={36} color={i <= rating ? '#FFD700' : '#E5E7EB'} />
              </TouchableOpacity>
              
            ))}
          </View>

          {/* Commentaire */}
          <Text style={styles.modalLabel}>Commentaire (optionnel)</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="Partagez votre expérience..."
            placeholderTextColor="#9CA3AF"
            value={comment}
            onChangeText={setComment}
            multiline numberOfLines={4}
            maxLength={500}
          />

          <TouchableOpacity
            style={[styles.submitBtn, (rating === 0 || submitting) && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={rating === 0 || submitting}
            activeOpacity={0.85}
          >
            {submitting
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.submitBtnText}>Publier mon avis</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// Main screen 
export default function ProductDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { article_id } = useLocalSearchParams<{ article_id: string }>();

  const [article,       setArticle]       = useState<Article | null>(null);
  const [similar,       setSimilar]       = useState<Article[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [quantity,      setQuantity]      = useState(1);
  const [wished,        setWished]        = useState(false);
  const [adding,        setAdding]        = useState(false);
  const [toggling,      setToggling]      = useState(false);
  const [reviews,       setReviews]       = useState<Review[]>([]);
  const [reviewStats,   setReviewStats]   = useState<ReviewStats | null>(null);
  const [reviewModal,   setReviewModal]   = useState(false);
  const [favoriteIds,   setFavoriteIds]   = useState<Set<number>>(new Set());
  const { applyCart } = useCartActions();

  const [fontsLoaded] = useFonts({
    Poppins_600SemiBold, Poppins_700Bold,
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
  });

  const loadReviews = async (id: number) => {
    try {
      const res = await ReviewsService.listByArticle(id);
      setReviews(res.data);
      setReviewStats(res.stats);
    } catch {}
  };

  const handleReviewVoted = (updated: Review) => {
    setReviews((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  };

  useEffect(() => {
    const load = async () => {
      try {
        const id  = Number(article_id);
        const [art, favs] = await Promise.all([
          CatalogService.getArticleDetail(id),
          ProfileService.listFavorites().catch(() => []),
        ]);
        setArticle(art);
        setFavoriteIds(new Set(favs.map((f: any) => f.id)));
        await loadReviews(id);
        if (art.category?.id) {
          const res = await CatalogService.getArticlesByCategory(art.category.id, { limit: 8 });
          setSimilar(res.data.filter((a: Article) => a.id !== id).slice(0, 8));
        }
      } catch {
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [article_id]);

  if (!fontsLoaded || loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={RED} /></View>;
  }

  if (!article) {
    return (
      <View style={styles.centered}>
        <Feather name="alert-circle" size={48} color="#E0E0E0" />
        <Text style={{ color: '#9CA3AF', marginTop: 12, fontFamily: 'Inter_500Medium' }}>Produit introuvable</Text>
      </View>
    );
  }

  const images = article.images?.length ? article.images : (article.image_url ? [article.image_url] : []);
  const total  = (article.price_ttc * quantity).toFixed(2);

  const handleAddToCart = async () => {
    if (!article.sku_id) return Alert.alert('Indisponible', "Ce produit n'est pas disponible.");
    try {
      setAdding(true);
      const cart = await CartService.addItem(article.sku_id, quantity);
      applyCart(cart);
    } catch (e: any) {
      Alert.alert('Erreur', e.message || "Erreur lors de l'ajout au panier");
    } finally { setAdding(false); }
  };

  const handleToggleWish = async () => {
    if (toggling) return;
    setToggling(true);
    const next = !wished;
    setWished(next);
    try {
      if (next) await ProfileService.addFavorite(article.id);
      else      await ProfileService.removeFavorite(article.id);
    } catch { setWished(!next); }
    finally   { setToggling(false); }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90 }}>
        {/* ── Carousel ── */}
        <View>
          <ImageCarousel images={images} />
          <View style={[styles.heroButtons, { top: insets.top + 10 }]}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
              <Feather name="chevron-left" size={22} color={RED} />
            </TouchableOpacity>
            <View style={styles.heroRight}>
              <TouchableOpacity style={styles.iconBtn} onPress={handleToggleWish}>
                <MaterialCommunityIcons name={wished ? "heart" : "heart-outline"} size={18} color={RED}/>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── Sheet ── */}
        <View style={styles.sheet}>
          <View style={styles.topRow}>
            <Text style={styles.category}>{article.category?.name_fr?.toUpperCase() ?? ''}</Text>
            {reviewStats && reviewStats.review_count > 0 && (
              <View style={styles.ratingBadge}>
                <Ionicons name="star" size={14} color="#FFD700" />
                <Text style={styles.ratingText}>{reviewStats.average_rating?.toFixed(1)}</Text>
              </View>
            )}
          </View>

          <Text style={styles.name}>{article.name_fr}</Text>

          <View style={styles.priceQtyRow}>
            <View>
              <Text style={styles.price}>{article.price_ttc.toFixed(2)} DH</Text>
              {article.unit_sale && article.unit_sale !== 'unit' && (
                <Text style={styles.unit}>/ {article.unit_sale}</Text>
              )}
            </View>
            <View style={styles.qtyRow}>
              <TouchableOpacity
                style={[styles.qtyBtn, quantity <= 1 && styles.qtyBtnDisabled]}
                onPress={() => setQuantity(q => Math.max(1, q - 1))}>
                <Feather name="minus" size={16} color={quantity <= 1 ? '#D1D5DB' : '#1a1a1a'} />
              </TouchableOpacity>
              <Text style={styles.qtyValue}>{quantity}</Text>
              <TouchableOpacity style={styles.qtyBtn} onPress={() => setQuantity(q => q + 1)}>
                <Feather name="plus" size={16} color="#1a1a1a" />
              </TouchableOpacity>
            </View>
          </View>

          {!!article.description_fr && (
            <>
              <Text style={styles.sectionLabel}>Description</Text>
              <Text style={styles.description}>{article.description_fr}</Text>
            </>
          )}

          {/* Badges */}
          <View style={styles.badgesRow}>
            <View style={[styles.infoBadge, { borderColor: '#25CF77', backgroundColor: '#E4F3EC'  }]}>
              <View style={[styles.badgeIcon, { backgroundColor: '#ffffff' }]}>
                <Feather name="check-circle" size={14} color="#059669" />
              </View>
              <View>
                <Text style={styles.badgeTitle}>Qualité</Text>
                <Text style={styles.badgeSub}>Certifiée</Text>
              </View>
            </View>
            <View style={[styles.infoBadge, { borderColor: '#E5EAE6', backgroundColor: '#F7F7F7'  }]}>
              <View style={[styles.badgeIcon, { backgroundColor: '#ffffff' }]}>
                <Feather name="info" size={14} color={RED} />
              </View>
              <View>
                <Text style={styles.badgeTitle}>Stock</Text>
                <Text style={styles.badgeSub}>Disponible</Text>
              </View>
            </View>
          </View>

          {/* ── Section avis ── */}
          <ReviewsSection
            articleId={article.id}
            stats={reviewStats}
            reviews={reviews}
            onWriteReview={() => setReviewModal(true)}
            onReviewVoted={handleReviewVoted}
          />

          {/* ── Produits similaires ── */}
          {similar.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Produits similaires</Text>
              <ScrollView
                horizontal showsHorizontalScrollIndicator={false}
                style={styles.similarScroll}
                contentContainerStyle={styles.similarScrollContent}
              >
                {similar.map(sim => (
                  <ProductCard
                    key={sim.id} article={sim}
                    isFav={favoriteIds.has(sim.id)}
                    onToggleFav={(next) => setFavoriteIds(prev => {
                      const s = new Set(prev);
                      if (next) s.add(sim.id); else s.delete(sim.id);
                      return s;
                    })}
                    onPress={() => router.push({ pathname: '/main/product-detail' as any, params: { article_id: sim.id } })}
                  />
                ))}
              </ScrollView>
            </>
          )}
        </View>
      </ScrollView>

      {/* ── Footer ── */}
{/* ── Footer ── */}
<View style={styles.footer}>
  <View style={styles.footerLeft}>
    <View style={styles.totalBlock}>
      <Text style={styles.totalLabel}>TOTAL</Text>
      <Text style={styles.totalValue}>{total} DH</Text>
    </View>
    <TouchableOpacity style={styles.reviewFooterBtn} onPress={() => setReviewModal(true)} activeOpacity={0.8}>
      <Ionicons name="star" size={14} color={RED} />
      <Text style={styles.reviewFooterBtnText}>un avis</Text>
    </TouchableOpacity>
  </View>

  <TouchableOpacity
    style={[styles.cartBtn, adding && { opacity: 0.7 }]}
    onPress={handleAddToCart} disabled={adding} activeOpacity={0.85}
  >
    {adding
      ? <ActivityIndicator color="#fff" />
      : <><Feather name="shopping-cart" size={18} color="#fff" /><Text style={styles.cartBtnText}>Ajouter au panier</Text></>
    }
  </TouchableOpacity>
</View>

      {/* ── Modal avis ── */}
      <WriteReviewModal
        visible={reviewModal}
        articleId={article.id}
        onClose={() => setReviewModal(false)}
        onSuccess={() => loadReviews(article.id)}
      />
    </SafeAreaView>
  );
}

// Styles 
const styles = StyleSheet.create({
  safeArea:  { flex: 1, backgroundColor: '#fff' },
  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  heroContainer:   { width, height: IMG_H, backgroundColor: '#F5F5F5' },
  heroImage:       { width, height: IMG_H },
  heroPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  dots:      { position: 'absolute', bottom: 14, flexDirection: 'row', alignSelf: 'center', gap: 6 },
  dot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.2)' },
  dotActive: { width: 18, backgroundColor: RED },
  heroButtons: {
    position: 'absolute',
    left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  heroRight: { flexDirection: 'row', gap: 10 },
  iconBtn:   { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FCE6E5', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4 },
  sheet:     { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -28, paddingHorizontal: 20, paddingTop: 24, 
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 4
   },
  topRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  category:  { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#8E8E93', letterSpacing: 1 , backgroundColor: '#F7F7F7', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 12 },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4 },
  ratingText:  { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#1A1A1A' },
  name:      { fontSize: 24, fontFamily: 'Poppins_700Bold', color: '#1a1a1a', marginBottom: 14, lineHeight: 30 },
  priceQtyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  price:     { fontSize: 28, fontFamily: 'Poppins_700Bold', color: RED },
  unit:      { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#9CA3AF', marginTop: 2 },
  qtyRow:    { flexDirection: 'row', alignItems: 'center', gap: 16 , borderRadius: 15, borderWidth: 1.5, borderColor: '#E5E7EB', paddingHorizontal: 8, paddingVertical: 4 , backgroundColor: '#F7F7F7' },
  qtyBtn:    { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  qtyBtnDisabled: { borderColor: '#F3F4F6' },
  qtyValue:  { fontSize: 18, fontFamily: 'Poppins_700Bold', color: '#1a1a1a', minWidth: 24, textAlign: 'center' },
  sectionLabel: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#1a1a1a', marginBottom: 8, marginTop: 4 },
  similarScroll: { marginHorizontal: -20, marginTop: 8, marginBottom: 60 },
  similarScrollContent: {paddingHorizontal: 20, paddingBottom: 8, gap: 12,},
  description:  { fontSize: 14, fontFamily: 'Inter_400Regular', color: '#6B7280', lineHeight: 20, marginBottom: 20 },
  badgesRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  infoBadge: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 14, padding: 12 },
  badgeIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  badgeTitle: { fontSize: 13, color: '#0A0A0A', fontFamily: 'Inter_700Bold' },
  badgeSub:   { fontSize: 11, fontFamily: 'Inter_400Regular', color: '#8E8E93' },

  // Reviews
  reviewsSection: { marginBottom: 12 },
  ratingBar:      { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, backgroundColor: '#ffffff', borderRadius: 14, padding: 14 },
  ratingBig:      { fontSize: 44, fontFamily: 'Poppins_700Bold', color: '#1a1a1a' },
  ratingBarRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ratingBarLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', color: '#6B7280', width: 10 },
  ratingBarTrack: { flex: 1, height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, overflow: 'hidden' },
  ratingBarFill:  { height: '100%', backgroundColor: RED, borderRadius: 3 },
  ratingBarCount: { fontSize: 12, fontFamily: 'Inter_500Medium', color: '#9CA3AF', width: 24, textAlign: 'right' },
  reviewsHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  seeAllBtn:      { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAllText:     { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: RED },
  reviewCard:     { backgroundColor: '#fff', padding: 14, marginBottom: 10,  },
  reviewHeader:   { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  reviewName:     { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#1a1a1a' },
  reviewDate:     { fontSize: 11, fontFamily: 'Inter_400Regular', color: '#9CA3AF' },
  reviewComment:  { fontSize: 13.5, fontFamily: 'Inter_400Regular', color: '#374151', lineHeight: 20, marginBottom: 10 },
  noReviewsBox: {
  alignItems: 'center', justifyContent: 'center',
  paddingVertical: 32, gap: 8,
  backgroundColor: '#FAFAFA', borderRadius: 14,
},
noReviewsTitle: {
  fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#6B7280', marginTop: 4,
},
noReviewsSubtitle: {
  fontSize: 12, fontFamily: 'Inter_400Regular', color: '#9CA3AF',
  textAlign: 'center', paddingHorizontal: 24,
},
  verifiedBadge:  { backgroundColor: '#F0FDF4', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  verifiedText:   { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: '#16A34A' },
  helpfulBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  helpfulBtnActive: { backgroundColor: '#FFF0F0' },
  helpfulText:    { fontSize: 12, fontFamily: 'Inter_500Medium', color: '#9CA3AF' },
  avatar:         { alignItems: 'center', justifyContent: 'center' },
  avatarText:     { color: '#fff', fontFamily: 'Inter_700Bold' },

  // Footer
  footer: {
  position: 'absolute', bottom: 0, left: 0, right: 0,
  flexDirection: 'row', alignItems: 'flex-end', gap: 12,   
  backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 14,
  paddingBottom: Platform.OS === 'ios' ? 32 : 18,
  borderTopWidth: 1, borderTopColor: '#E5E5EA',
},

footerLeft: {
  justifyContent: 'space-between',
  gap: 8,
},

totalBlock: {},
totalLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', color: '#8E8E93', letterSpacing: 0.5 },
totalValue: { fontSize: 20, fontFamily: 'Poppins_700Bold', color: '#1a1a1a', marginTop: 2 },

reviewFooterBtn: {
  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  borderWidth: 1.5, borderColor: RED, borderRadius: 16,
  paddingHorizontal: 16, paddingVertical: 14,
  backgroundColor: '#fff',
},
reviewFooterBtnText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: RED },

cartBtn: {
  flex: 1,
  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  backgroundColor: RED, borderRadius: 16,
  paddingVertical: 17,     
  paddingHorizontal: 12,
  shadowColor: RED, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
},
cartBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },  

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet:   { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 28 },
  modalHandle:  { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 20 },
  modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle:   { fontSize: 18, fontFamily: 'Poppins_700Bold', color: '#1a1a1a' },
  modalLabel:   { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#6B7280', marginBottom: 10 },
  starsRow:     { flexDirection: 'row', gap: 10, marginBottom: 20, alignSelf: 'center' },
  modalInput:   { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, padding: 14, fontFamily: 'Inter_400Regular', fontSize: 14, color: '#1a1a1a', textAlignVertical: 'top', minHeight: 100, marginBottom: 20 },
  submitBtn:    { backgroundColor: RED, borderRadius: 16, paddingVertical: 15, alignItems: 'center', shadowColor: RED, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
  submitBtnText:{ fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#fff' },
});