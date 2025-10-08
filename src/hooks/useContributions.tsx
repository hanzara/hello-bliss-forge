import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useContributions = (chamaId: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const makeContribution = useMutation({
    mutationFn: async (params: {
      amount: number;
      paymentMethod: string;
      paymentReference?: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('make-contribution', {
        body: {
          chamaId,
          ...params
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chama-members', chamaId] });
      queryClient.invalidateQueries({ queryKey: ['chama-contributions', chamaId] });
      queryClient.invalidateQueries({ queryKey: ['chama-leaderboard', chamaId] });
      toast({
        title: '🎉 Contribution Made!',
        description: 'Your contribution has been recorded successfully'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to make contribution',
        variant: 'destructive'
      });
    }
  });

  return {
    makeContribution,
    isProcessing: makeContribution.isPending
  };
};
