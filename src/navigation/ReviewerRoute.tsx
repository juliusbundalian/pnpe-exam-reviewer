import { StudyRoute, StudyReviewer } from './StudyRoute';
import { GeneratedIdSchema } from '../features/study/domain/study';
import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAppDependencies, useAppNavigation, useConfig } from '../bootstrap/AppProviders';
import { taxonomy } from '../features/content/domain/taxonomy';
import type { CategoryOverview } from '../features/content/domain/CategoryRepository';
import { CategoryOverviewScreen } from '../features/content/presentation/CategoryOverviewScreen';
import { SubcategoryOverviewScreen } from '../features/content/presentation/SubcategoryOverviewScreen';
import { FeatureAvailabilityScreen } from '../core/components/FeatureAvailabilityScreen';
import { ProtectedRoute } from './ProtectedRoute';
import { startBlock } from './startAvailability';
import { useSafeBack } from './useSafeBack';
export function ReviewerRoute() {
  const params = useLocalSearchParams<{
    categoryId?: string;
    subcategoryId?: string;
    stage?: string;
    sessionId?: string;
  }>();
  const router = useRouter();
  const onBack = useSafeBack({ type: 'reviewerOverview' });
  const { categories } = useAppDependencies();
  const navigation = useAppNavigation();
  const config = useConfig('app_info');
  const [metadata, setMetadata] = useState<readonly CategoryOverview[]>([]);
  useEffect(() => {
    let active = true;
    void categories.list().then(
      (value) => {
        if (active) setMetadata(value);
      },
      () => {},
    );
    return () => {
      active = false;
    };
  }, [categories]);
  const category = taxonomy.find((entry) => entry.id === params.categoryId);
  const child = category?.subcategories.find((entry) => entry.id === params.subcategoryId);
  if (
    (params.categoryId && !category) ||
    (params.subcategoryId && !child) ||
    (params.sessionId !== undefined && !GeneratedIdSchema.safeParse(params.sessionId).success)
  )
    return <FeatureAvailabilityScreen title="Not Found" onBack={onBack} />;
  const action = category
    ? {
        type: 'startReviewer' as const,
        categoryId: category.id,
        ...(child ? { subcategoryId: child.id } : {}),
      }
    : null;
  const blocked = startBlock(config);
  if (params.sessionId || ((params.stage === 'availability' || params.stage === 'start') && action))
    return (
      <ProtectedRoute
        action={
          params.sessionId ? { type: 'resumeReviewer', sessionId: params.sessionId } : action!
        }
      >
        <StudyRoute onBack={onBack}>
          {(study) => (
            <StudyReviewer
              key={params.sessionId ?? JSON.stringify(action)}
              study={study}
              {...(action
                ? {
                    scope: {
                      categoryId: action.categoryId,
                      ...(action.subcategoryId ? { subcategoryId: action.subcategoryId } : {}),
                    },
                  }
                : {})}
              {...(params.sessionId ? { sessionId: params.sessionId } : {})}
              onBack={onBack}
            />
          )}
        </StudyRoute>
      </ProtectedRoute>
    );
  const overview = metadata.find((entry) => entry.categoryId === category?.id);
  if (child && action)
    return (
      <SubcategoryOverviewScreen
        title={child.label}
        onBack={onBack}
        blocked={blocked}
        availability={
          overview?.subcategories.find((entry) => entry.subcategoryId === child.id)
            ?.availability ?? { status: 'unknown' }
        }
        onStart={(target) => navigation.require(action, target)}
      />
    );
  return (
    <CategoryOverviewScreen
      {...(category ? { categoryId: category.id } : {})}
      blocked={blocked}
      availability={overview?.availability ?? { status: 'unknown' }}
      onBack={onBack}
      onOpen={(id, sub) => router.push(sub ? `/review/${id}/${sub}` : `/review/${id}`)}
      {...(action
        ? {
            onStart: (
              target: import('../core/components/AppModal').AccessibilityFocusTarget | null,
            ) => navigation.require(action, target),
          }
        : {})}
    />
  );
}
