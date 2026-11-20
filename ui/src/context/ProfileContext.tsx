import React, { createContext, useContext, ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  api,
  queryKeys,
  readLocalProfile,
  readLocalSettings,
  getInitials,
  type UserProfile,
  type AppSettings,
} from "@/services/api";

interface ProfileContextType {
  profile: UserProfile;
  initials: string;
  settings: AppSettings;
  updateProfile: (patch: Partial<UserProfile>) => Promise<UserProfile>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<AppSettings>;
  isSaving: boolean;
  isLoading: boolean;
}

const ProfileContext = createContext<ProfileContextType | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data: profile = readLocalProfile(), isLoading: isProfileLoading } = useQuery({
    queryKey: queryKeys.profile,
    queryFn: () => api.getProfile(),
    initialData: readLocalProfile,
  });

  const { data: settings = readLocalSettings(), isLoading: isSettingsLoading } = useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => api.getSettings(),
    initialData: readLocalSettings,
  });

  const profileMutation = useMutation({
    mutationFn: (newProfile: UserProfile) => api.saveProfile(newProfile),
    onSuccess: (saved) => {
      queryClient.setQueryData(queryKeys.profile, saved);
      queryClient.setQueryData(queryKeys.settings, (prev: AppSettings | undefined) =>
        prev ? { ...prev, profile: saved } : undefined
      );
    },
  });

  const settingsMutation = useMutation({
    mutationFn: (newSettings: AppSettings) => api.saveSettings(newSettings),
    onSuccess: (saved) => {
      queryClient.setQueryData(queryKeys.settings, saved);
      queryClient.setQueryData(queryKeys.profile, saved.profile);
    },
  });

  const updateProfile = async (patch: Partial<UserProfile>): Promise<UserProfile> => {
    const updated: UserProfile = { ...profile, ...patch };
    return await profileMutation.mutateAsync(updated);
  };

  const updateSettings = async (patch: Partial<AppSettings>): Promise<AppSettings> => {
    const updated: AppSettings = { ...settings, ...patch };
    return await settingsMutation.mutateAsync(updated);
  };

  return (
    <ProfileContext.Provider
      value={{
        profile,
        initials: getInitials(profile?.name),
        settings,
        updateProfile,
        updateSettings,
        isSaving: profileMutation.isPending || settingsMutation.isPending,
        isLoading: isProfileLoading || isSettingsLoading,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile(): ProfileContextType {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    const fallbackProfile = readLocalProfile();
    const fallbackSettings = readLocalSettings();
    return {
      profile: fallbackProfile,
      initials: getInitials(fallbackProfile?.name),
      settings: fallbackSettings,
      updateProfile: async (patch) => ({ ...fallbackProfile, ...patch }),
      updateSettings: async (patch) => ({ ...fallbackSettings, ...patch }),
      isSaving: false,
      isLoading: false,
    };
  }
  return ctx;
}
