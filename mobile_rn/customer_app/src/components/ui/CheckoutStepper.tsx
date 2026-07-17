import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

const RED = '#E10600';

export type StepStatus = 'done' | 'active' | 'pending';

export interface Step {
  label: string;
}

interface CheckoutStepperProps {
  steps?:       Step[];
  currentStep:  number;
}

const DEFAULT_STEPS: Step[] = [
  { label: 'Livraison / Retrait' },
  { label: 'Date & Heure' },
  { label: 'Paiement' },
];

export default function CheckoutStepper({
  steps = DEFAULT_STEPS,
  currentStep,
}: CheckoutStepperProps) {
  const getStatus = (index: number): StepStatus => {
    const stepNum = index + 1;
    if (stepNum < currentStep) return 'done';
    if (stepNum === currentStep) return 'active';
    return 'pending';
  };

  return (
    <View style={styles.stepper}>
      {steps.map((step, index) => {
        const status = getStatus(index);
        const isLast = index === steps.length - 1;

        return (
          <React.Fragment key={index}>
            <View style={styles.stepItem}>
              <View
                style={[
                  styles.stepCircle,
                  status === 'done'   && styles.stepCircleDone,
                  status === 'active' && styles.stepCircleActive,
                ]}
              >
                {status === 'done' ? (
                  <Feather name="check" size={14} color="#fff" />
                ) : (
                  <Text
                    style={[
                      styles.stepNumber,
                      status === 'active' && styles.stepNumberActive,
                    ]}
                  >
                    {index + 1}
                  </Text>
                )}
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  (status === 'active' || status === 'done') && styles.stepLabelActive,
                ]}
              >
                {step.label}
              </Text>
            </View>

            {!isLast && (
              <View
                style={[
                  styles.stepLine,
                  getStatus(index + 1) !== 'pending' && styles.stepLineActive,
                ]}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stepper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  stepItem: { alignItems: 'center', flex: 1 },
  stepLine: { flex: 0.5, height: 1.5, backgroundColor: '#dfe1e5', marginTop: 13 },
  stepLineActive: { backgroundColor: RED },
  stepCircle: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1.5, borderColor: '#9A9A9A',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff', marginBottom: 6,
  },
  stepCircleActive: { borderColor: RED, backgroundColor: '#fff' },
  stepCircleDone:   { borderColor: RED, backgroundColor: RED },
  stepNumber:       { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: '#9A9A9A' },
  stepNumberActive: { color: RED },
  stepLabel:        { fontSize: 12, fontFamily: 'Poppins_500Medium', color: '#111111', textAlign: 'center' },
  stepLabelActive:  { color: RED, fontFamily: 'Poppins_700Bold' },
});