import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import QRCode from 'react-native-qrcode-svg';

const COLORS = {
  dark: '#0F172A',
  primary: '#D90404',
  white: '#FFFFFF',
  text: '#111827',
  secondary: '#6B7280',
  border: '#1F2937',
};

// -----------------------------------------------------------------------
// MOCK — à remplacer par les vraies données de la commande
// -----------------------------------------------------------------------
const MOCK_TICKET = {
  shopName: 'EL HERRI',
  shopSubtitle: 'Supermarché & Drive',
  orderRef: 'ELH-5021',
  clientName: 'Ahmed Benali',
  type: 'Retrait',
  articlesCount: 8,
  emplacement: 'A-03',
  date: '06 Juil 2026',
  time: '14:35',
  status: 'PRÊTE',
  footerLine1: 'Merci pour votre confiance.',
  footerLine2: 'El Herri - Toujours à vos côtés',
};

// -----------------------------------------------------------------------
// Génère le HTML utilisé par expo-print (PDF / impression réelle).
// C'est CE template qui définit le rendu final imprimé — pas la vue RN.
// -----------------------------------------------------------------------
function buildTicketHtml(t: typeof MOCK_TICKET, qrValue: string) {
  return `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, Helvetica, Arial, sans-serif;
            padding: 24px;
            color: #111827;
          }
          .ticket {
            max-width: 320px;
            margin: 0 auto;
          }
          .center { text-align: center; }
          .shop-name {
            font-size: 20px;
            font-weight: 800;
            letter-spacing: 1px;
            margin: 0;
          }
          .shop-sub {
            font-size: 11px;
            color: #6B7280;
            margin-top: 2px;
          }
          .dashed {
            border-top: 1px dashed #9CA3AF;
            margin: 14px 0;
          }
          .label {
            font-size: 10px;
            letter-spacing: 1px;
            color: #6B7280;
            text-transform: uppercase;
          }
          .ref {
            font-size: 20px;
            font-weight: 800;
            margin-top: 2px;
          }
          .row {
            display: flex;
            justify-content: space-between;
            font-size: 13px;
            margin-bottom: 6px;
          }
          .row .k { color: #374151; }
          .row .v { font-weight: 700; }
          .emplacement-box {
            background: #111827;
            color: #FFFFFF;
            border-radius: 6px;
            padding: 12px;
            text-align: center;
            margin: 14px 0;
          }
          .emplacement-label {
            font-size: 10px;
            letter-spacing: 2px;
            opacity: 0.7;
          }
          .emplacement-value {
            font-size: 24px;
            font-weight: 800;
            margin-top: 4px;
          }
          .datetime {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            color: #6B7280;
          }
          .qr-wrap {
            text-align: center;
            margin: 18px 0 8px;
          }
          .scan-hint {
            font-size: 10px;
            color: #9CA3AF;
            text-align: center;
            margin-top: 6px;
          }
          .status-box {
            border: 1.5px solid #111827;
            border-radius: 6px;
            padding: 6px 0;
            text-align: center;
            font-weight: 800;
            font-size: 13px;
            letter-spacing: 1px;
            width: 120px;
            margin: 6px auto 0;
          }
          .footer {
            text-align: center;
            font-size: 11px;
            color: #6B7280;
            margin-top: 14px;
          }
        </style>
      </head>
      <body>
        <div class="ticket">
          <div class="center">
            <p class="shop-name">${t.shopName}</p>
            <p class="shop-sub">${t.shopSubtitle}</p>
          </div>

          <div class="dashed"></div>

          <div class="center">
            <p class="label">Commande</p>
            <p class="ref">#${t.orderRef}</p>
          </div>

          <div class="dashed"></div>

          <div class="row"><span class="k">Client:</span><span class="v">${t.clientName}</span></div>
          <div class="row"><span class="k">Type:</span><span class="v">${t.type}</span></div>
          <div class="row"><span class="k">Articles:</span><span class="v">${t.articlesCount}</span></div>

          <div class="emplacement-box">
            <p class="emplacement-label">EMPLACEMENT</p>
            <p class="emplacement-value">${t.emplacement}</p>
          </div>

          <div class="dashed"></div>

          <div class="datetime">
            <span>${t.date}</span>
            <span>${t.time}</span>
          </div>

          <div class="dashed"></div>

          <div class="qr-wrap">
            <img
              src="https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(qrValue)}"
              width="120"
              height="120"
            />
            <p class="scan-hint">Scannez pour valider</p>
          </div>

          <div class="dashed"></div>

          <p class="label center">Statut</p>
          <div class="status-box">${t.status}</div>

          <div class="footer">
            <p>${t.footerLine1}</p>
            <p>${t.footerLine2}</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

export default function OrderTicketScreen() {
  const router = useRouter();
  const { id, autoPrint } = useLocalSearchParams<{ id: string; autoPrint?: string }>();

  const [printing, setPrinting] = useState(false);
  const hasAutoPrinted = useRef(false);

  const qrValue = `TICKET-${MOCK_TICKET.orderRef}-${id ?? ''}`;
  const ticketHtml = buildTicketHtml(MOCK_TICKET, qrValue);

  const handlePrint = async () => {
    try {
      setPrinting(true);
      await Print.printAsync({ html: ticketHtml });
    } catch (error) {
      console.error("Erreur lors de l'impression:", error);
    } finally {
      setPrinting(false);
    }
  };

  const handleSharePdf = async () => {
    try {
      setPrinting(true);
      const { uri } = await Print.printToFileAsync({ html: ticketHtml });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri);
      }
    } catch (error) {
      console.error('Erreur lors de la génération du PDF:', error);
    } finally {
      setPrinting(false);
    }
  };

  // Impression automatique si on vient du bouton "print" de l'écran précédent
  useEffect(() => {
    if (autoPrint === '1' && !hasAutoPrinted.current) {
      hasAutoPrinted.current = true;
      handlePrint();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPrint]);

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Aperçu visuel du ticket dans l'app (pas ce qui est imprimé) */}
        <View style={styles.ticketCard}>
          <View style={styles.center}>
            <Text style={styles.shopName}>{MOCK_TICKET.shopName}</Text>
            <Text style={styles.shopSub}>{MOCK_TICKET.shopSubtitle}</Text>
          </View>

          <View style={styles.dashed} />

          <View style={styles.center}>
            <Text style={styles.label}>COMMANDE</Text>
            <Text style={styles.ref}>#{MOCK_TICKET.orderRef}</Text>
          </View>

          <View style={styles.dashed} />

          <View style={styles.row}>
            <Text style={styles.rowKey}>Client:</Text>
            <Text style={styles.rowValue}>{MOCK_TICKET.clientName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowKey}>Type:</Text>
            <Text style={styles.rowValue}> {MOCK_TICKET.type}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowKey}>Articles:</Text>
            <Text style={styles.rowValue}>{MOCK_TICKET.articlesCount}</Text>
          </View>

          <View style={styles.emplacementBox}>
            <Text style={styles.emplacementLabel}>EMPLACEMENT</Text>
            <Text style={styles.emplacementValue}>{MOCK_TICKET.emplacement}</Text>
          </View>

          <View style={styles.dashed} />

          <View style={styles.datetimeRow}>
            <Text style={styles.datetimeText}>{MOCK_TICKET.date}</Text>
            <Text style={styles.datetimeText}>{MOCK_TICKET.time}</Text>
          </View>

          <View style={styles.dashed} />

          <View style={styles.center}>
            <QRCode value={qrValue} size={110} />
            <Text style={styles.scanHint}>Scannez pour valider</Text>
          </View>

          <View style={styles.dashed} />

          <View style={styles.center}>
            <Text style={styles.label}>Statut</Text>
            <View style={styles.statusBox}>
              <Text style={styles.statusText}>{MOCK_TICKET.status}</Text>
            </View>
          </View>

          <View style={styles.footerText}>
            <Text style={styles.footerLine}>{MOCK_TICKET.footerLine1}</Text>
            <Text style={styles.footerLine}>{MOCK_TICKET.footerLine2}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footerActions}>
        <TouchableOpacity style={styles.shareButton} onPress={handleSharePdf} disabled={printing}>
          <Ionicons name="share-outline" size={18} color={COLORS.white} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.printButton, printing && styles.printButtonDisabled]}
          onPress={handlePrint}
          disabled={printing}
        >
          {printing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="print-outline" size={18} color="#FFFFFF" />
              <Text style={styles.printButtonText}>Lancer l'impression</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.dark,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 16,
    marginTop: 8,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  ticketCard: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: 20,
  },
  center: {
    alignItems: 'center',
  },
  shopName: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: 1,
  },
  shopSub: {
    fontSize: 11,
    color: COLORS.secondary,
    marginTop: 2,
  },
  dashed: {
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#D1D5DB',
    marginVertical: 14,
  },
  label: {
    fontSize: 10,
    letterSpacing: 1.5,
    color: COLORS.secondary,
    textTransform: 'uppercase',
  },
  ref: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  rowKey: {
    fontSize: 13,
    color: '#374151',
  },
  rowValue: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  emplacementBox: {
    backgroundColor: '#111827',
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
    marginVertical: 14,
  },
  emplacementLabel: {
    fontSize: 10,
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.6)',
  },
  emplacementValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 4,
  },
  datetimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  datetimeText: {
    fontSize: 11,
    color: COLORS.secondary,
  },
  scanHint: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 8,
  },
  statusBox: {
    borderWidth: 1.5,
    borderColor: COLORS.text,
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 26,
    marginTop: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    color: COLORS.text,
  },
  footerText: {
    alignItems: 'center',
    marginTop: 14,
  },
  footerLine: {
    fontSize: 11,
    color: COLORS.secondary,
  },
  footerActions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
  },
  shareButton: {
    width: 50,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  printButton: {
    flex: 1,
    flexDirection: 'row',
    height: 52,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  printButtonDisabled: {
    opacity: 0.6,
  },
  printButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
