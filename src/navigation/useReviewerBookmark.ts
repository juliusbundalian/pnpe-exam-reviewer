import { useCallback, useEffect, useRef, useState } from 'react';
import type { StudyDependencies } from '../bootstrap/studyComposition';
import { StudyError } from '../features/study/domain/study';
import type { ReviewerBookmarkState } from '../features/reviewer/presentation/ReviewerScreen';

/** A bookmark response belongs to one visible page lifetime, never just an owner. */
export function useReviewerBookmark(study: StudyDependencies) {
  const current = useRef({
    mounted: false,
    key: '',
    request: 0,
    status: 'loading' as ReviewerBookmarkState,
    saved: false,
  });
  const [state, setState] = useState({
    key: '',
    status: 'loading' as ReviewerBookmarkState,
    saved: false,
    error: null as StudyError | null,
  });
  const page = useCallback(() => {
    const value = study.controller.snapshot();
    if (
      (value.kind !== 'reading' && value.kind !== 'completed' && value.kind !== 'error') ||
      !value.question ||
      !value.session ||
      value.ordinal === null
    )
      return null;
    const entry = value.session.items[value.ordinal]!.entry;
    return {
      entry,
      key: JSON.stringify([value.session.id, value.ordinal, value.pageToken, entry.id]),
    };
  }, [study]);
  const applies = (key: string, request: number) =>
    current.current.mounted &&
    current.current.key === key &&
    current.current.request === request &&
    study.guard.isCurrent(study.owner) &&
    page()?.key === key;
  const publish = (
    key: string,
    status: ReviewerBookmarkState,
    saved = false,
    error: StudyError | null = null,
  ) => {
    current.current.status = status;
    current.current.saved = saved;
    setState({ key, status, saved, error });
  };
  const lookup = useCallback(
    (force = false) => {
      const target = page();
      const key = target?.key ?? '';
      if (!force && key === current.current.key) return;
      current.current.key = key;
      const request = ++current.current.request;
      publish(key, 'loading');
      if (!target || !study.guard.isCurrent(study.owner)) return;
      void study.bookmarks.list(study.owner).then(
        (rows) => {
          if (applies(key, request))
            publish(
              key,
              'ready',
              rows.some((row) => row.questionId === target.entry.id),
            );
        },
        (error) => {
          if (applies(key, request))
            publish(
              key,
              'error',
              false,
              error instanceof StudyError ? error : new StudyError('storage-unavailable'),
            );
        },
      );
    },
    [study, page],
  );
  useEffect(() => {
    current.current.mounted = true;
    lookup(true);
    const unsubscribe = study.controller.subscribe(() => lookup());
    return () => {
      current.current.mounted = false;
      ++current.current.request;
      unsubscribe();
    };
  }, [study, lookup]);
  const toggle = () => {
    const target = page();
    if (
      !target ||
      current.current.key !== target.key ||
      current.current.status !== 'ready' ||
      !study.guard.isCurrent(study.owner)
    )
      return;
    const request = ++current.current.request;
    const desiredSaved = !current.current.saved;
    publish(target.key, 'saving');
    void study.bookmarks.setSaved(study.owner, target.entry, desiredSaved).then(
      (bookmark) => {
        if (applies(target.key, request)) publish(target.key, 'ready', !bookmark.deleted);
      },
      (error) => {
        if (applies(target.key, request))
          publish(
            target.key,
            'error',
            false,
            error instanceof StudyError ? error : new StudyError('storage-unavailable'),
          );
      },
    );
  };
  const matches = state.key === (page()?.key ?? '');
  return {
    saved: matches && state.saved,
    status: matches ? state.status : ('loading' as ReviewerBookmarkState),
    error: matches ? state.error : null,
    toggle,
    // Re-read committed state instead of blindly repeating a potentially successful toggle.
    retry: () => lookup(true),
  };
}
