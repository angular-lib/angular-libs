import { Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ALStore } from '../al-store';
import { rxResourcePlugin } from '../../../rxjs-interop/src/lib/plugins/rx-resource.plugin';

/**
 * Lives under the main `store` project's `src/` so the Angular CLI test builder (which only
 * discovers spec files under the project's `sourceRoot`) picks it up, even though the plugin
 * under test is physically part of the `rxjs-interop` secondary entry point.
 */

interface ProfileState {
  profile: { name: string } | null;
}
const initialProfileState: ProfileState = { profile: null };

describe('rxResourcePlugin', () => {
  it('should patch the store when the observable emits and expose isLoading/value/reload', async () => {
    const dataSubject = new Subject<{ name: string }>();
    const loader = vi.fn(() => dataSubject.asObservable());

    @Injectable()
    class ProfileStore extends ALStore<ProfileState> {
      profileResource = this.registerPlugin(rxResourcePlugin('profile', { loader }));

      constructor() {
        super(initialProfileState);
      }
    }

    TestBed.configureTestingModule({ providers: [ProfileStore] });
    const store = TestBed.inject(ProfileStore);

    expect(store.profileResource.isLoading()).toBe(true);
    expect(store.get('profile')).toBeNull();

    await vi.waitFor(() => {
      expect(loader).toHaveBeenCalled();
    });
    dataSubject.next({ name: 'Ava' });

    await vi.waitFor(() => {
      expect(store.get('profile')).toEqual({ name: 'Ava' });
    });

    expect(store.profileResource.value()).toEqual({ name: 'Ava' });
    expect(store.profileResource.isLoading()).toBe(false);
  });

  it('should re-run the loader and patch the store again when reload() is called', async () => {
    const subjects: Subject<{ name: string }>[] = [];
    const loader = vi.fn(() => {
      const subject = new Subject<{ name: string }>();
      subjects.push(subject);
      return subject.asObservable();
    });

    @Injectable()
    class ProfileStore extends ALStore<ProfileState> {
      profileResource = this.registerPlugin(rxResourcePlugin('profile', { loader }));

      constructor() {
        super(initialProfileState);
      }
    }

    TestBed.configureTestingModule({ providers: [ProfileStore] });
    const store = TestBed.inject(ProfileStore);

    await vi.waitFor(() => {
      expect(loader).toHaveBeenCalledTimes(1);
    });
    subjects[0].next({ name: 'call-1' });

    await vi.waitFor(() => {
      expect(store.get('profile')).toEqual({ name: 'call-1' });
    });

    store.profileResource.reload();

    await vi.waitFor(() => {
      expect(loader).toHaveBeenCalledTimes(2);
    });
    subjects[1].next({ name: 'call-2' });

    await vi.waitFor(() => {
      expect(store.get('profile')).toEqual({ name: 'call-2' });
    });
  });
});
