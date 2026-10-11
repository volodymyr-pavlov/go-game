package game

import (
	"math/rand/v2"
	"testing"
)

func seeded(seed uint64) *rand.Rand {
	return rand.New(rand.NewPCG(seed, seed))
}

func TestSearchWinsTheCapturingRace(t *testing.T) {
	// Both groups in the top row have only one free point left, at 3,0. The side that plays there captures the other group.
	p := position([]string{
		"OOO.XXX",
		"XXXXOOO",
		"XXX.OOO",
		"X.X.O.O",
		"XXX.OOO",
		"X.X.O.O",
		"XXX.OOO",
	}, Black)
	result := Search(p, 400, seeded(7))
	if result.Move.Pass || result.Move.Point != (Point{X: 3, Y: 0}) {
		t.Fatalf("move = %+v", result.Move)
	}
	if result.WinRate <= 0.5 {
		t.Fatalf("winRate = %v", result.WinRate)
	}
}

func TestDecisiveLeadPassesAfterOpponentPasses(t *testing.T) {
	rows := make([]string, 7)
	for i := range rows {
		rows[i] = ".X.O..."
	}
	result := Search(position(rows, Black).Pass(), 1000, seeded(3))
	if !result.Move.Pass {
		t.Fatalf("move = %+v, want pass", result.Move)
	}
	if result.WinRate <= 0.5 {
		t.Fatalf("winRate = %v", result.WinRate)
	}
}

func TestHopelessPositionReportsLowWinRate(t *testing.T) {
	rows := make([]string, 9)
	for i := range rows[:8] {
		rows[i] = "XXXXXXXX."
	}
	rows[8] = "........."
	result := Search(position(rows, White), 100, seeded(1))
	if result.WinRate >= 0.2 {
		t.Fatalf("winRate = %v, want a losing rate", result.WinRate)
	}
}

func BenchmarkSearch9x9(b *testing.B) {
	p := Initial(9)
	for b.Loop() {
		Search(p, 200, seeded(1))
	}
}
